import React, { useState, useMemo, useCallback, useEffect, cloneElement, useRef } from "react";
import { formatCompactMoney } from "@/app/currency/money";
import { partnerCurrencyOf } from "@/app/currency/partnerCurrency";
import { createPortal } from "react-dom";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command, CommandList, CommandEmpty, CommandGroup, CommandItem } from "../ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { ItemHoverCardContent } from "./ItemHoverCardContent";
import { PrimaryPill } from "./PrimaryPill";
import { VendorPriorityList, computeRoster, MAX_PRIORITY, type RosterInputVendor } from "./VendorPriorityList";
import {
  Search,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  SlidersHorizontal,
  AlignJustify,
  List as ListIcon,
  LayoutGrid,
  Package,
  Maximize2,
  Minimize2,
  Sparkles,
  ChartColumn,
  Tag,
  ShoppingCart,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  Trash2,
  AlertTriangle,
  Shield,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowUpDown,
  Mail,
  Building2,
  Lock,
  Phone,
  ExternalLink,
  Layers,
  Hash,
  ListOrdered,
  Info,
  Settings2,
  Truck,
  TrendingDown,
  TrendingUp,
  Calendar,
  Clock,
  Receipt,
  Star,
  XCircle,
} from "lucide-react";
import { SHIPPING_CARRIER_CATALOG, SHIPPING_CARRIER_METHODS, ShippingMethodCarrierCard, type ShippingCarrierEntry } from "./ShippingCarrierCard";
import { usePersonLightbox } from "./PersonAvatarLightbox";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import { toast } from "sonner";
import type { Vendor } from "../../data/vendors";
import { useVendors } from "../../context/VendorContext";
import { getLastUpdated } from "../../utils/lastUpdated";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "./ColumnSelector";
/* Embedded create-only instance of the Pricing Rules tab — runs the
   canonical Create/Duplicate Pricing Rule modal for the qualification
   flow's shared-rule warning. (Import cycle with PricingRulesTab is
   render-time only, so it's safe.) */
import { PricingRulesTabNew } from "./PricingRulesTab";
import {
  ColumnHeaderMenu,
  type SortConfig,
} from "./ColumnHeaderMenu";
import { TableEmptyRow, TableEmptyState, TableSkeletonRows, CardSkeletonGrid, resolveTableEmptyKind, useTableLoadState } from "../ui/table-empty-state";
import { findSearchSuggestion } from "../../utils/searchSuggestion";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Pricing + ordering parameters captured when a partner is added as a
 *  qualified vendor for an item. Mirrors the canonical
 *  Configure Vendor Details modal on the item-detail page so the
 *  same fields round-trip across both surfaces. Optional because items
 *  added in legacy flows (or via the approved-buyer side) have no
 *  pricing context yet. */
/** A single UoM-priced tier on a qualified-vendor row. Eli's ask: the
 *  same partner can sell the same item in different units (Each, Box,
 *  Pallet, …) at independent prices — the price does NOT convert, the
 *  quantity does. So we capture an explicit primary price/UoM pair on
 *  the config plus a stackable list of additional pairs. */
export interface AdditionalPriceTier {
  price: string;
  uom: string;
  /** Per-UoM ordering rules — Eli's pass: min/max/multiples are
   *  meaningful per pack size, not item-wide (5kg vs 10kg vs 15kg
   *  packs each have their own minimum order). Tolerance + lead
   *  time travel with the same row so the full ordering contract
   *  for that UoM lives in one place. All optional — blank strings
   *  mean "no rule for this UoM". */
  minOrderQty?: string;
  maxOrderQty?: string;
  multiples?: string;
  acceptedDeviationPct?: string;
  leadTimeDays?: string;
}

export interface QualifiedVendorConfig {
  /** Vendor priority for the item — defaults to "auto" so the new
   *  qualified vendor gets the next-available slot among existing
   *  qualified vendors (NOT priority 1, which would replace whoever
   *  already holds it). User can override to pin a specific rank.
   *  Priorities are tie-allowing: several vendors can share the same
   *  level, mirroring the Items module's qualified-vendor model. */
  priority: string;
  /** True when this partner is starred as the item's primary vendor
   *  (the auto-PO anchor). At most one vendor per item is primary and
   *  it must sit at Priority 1 — same rule as the Items module. */
  isPrimaryVendor?: boolean;
  pricePerUnit: string;
  uom: string;
  /** Extra (price, UoM) pairs for the same partner + same item.
   *  Surfaced via the "Add price for another unit" CTA on the row.
   *  Empty / undefined when the user only captures the primary pair. */
  additionalPrices?: AdditionalPriceTier[];
  /** Draft-only pointer to which selling-unit card is marked primary
   *  while the Configure step is open. undefined / -1 = the base card
   *  (pricePerUnit/uom fields); 0..n-1 = additionalPrices[i]. Cards
   *  stay in place while editing so the user's context isn't lost;
   *  normalizePrimaryTier() resolves the pointer at save time by
   *  swapping the chosen tier into the base fields. */
  primaryTierIndex?: number;
  minOrderQty: string;
  maxOrderQty: string;
  multiples: string;
  acceptedDeviationPct: string;
  leadTimeDays: string;
  /** Optional location association — relevant at the partner level
   *  where the user can scope the qualified-vendor relationship to a
   *  specific partner location. Empty = applies across all locations. */
  locationId?: string;
  /** Carrier method ids enabled for this qualified-vendor row.
   *  References SHIPPING_CARRIER_METHODS so the same canonical
   *  catalogue powers both the partner-level Freight tab and this
   *  per-item configure step. */
  shippingMethodIds?: string[];
  /** Which shipping method on this row is the default for new POs. */
  defaultShippingMethodId?: string;
  /** Pricing-rule ids attached to this qualified-vendor row. Lives
   *  inside the Pricing Rules section in the Configure step,
   *  matching the canonical item-detail flow. Seeded from the
   *  partner's pricing rules on entry; user can remove or stack more. */
  appliedPricingRuleIds?: string[];
}

export interface PartnerItemData {
  id: string;
  partNo: string;
  description: string;
  manufacturer: string;
  sku: string;
  category: string;
  additionalCategory: string;
  itemType: "Parts" | "Equipment - Capital" | "Equipment - Non-Capital" | "Miscellaneous";
  itemControlType: "Serialized" | "Non-Serialized" | "Lot Controlled";
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock";
  onHand: number;
  onHandUnit: string;
  altUnits: string;
  inboundLocation: string;
  outboundLocation: string;
  acquisitionMethods: ("Purchased" | "Manufactured" | "Purchase")[];
  /** Pricing + ordering config when this row was added as a qualified
   *  vendor for the item. Absent on rows added as approved buyers (the
   *  other trade direction) or on legacy entries. */
  qualifiedVendorConfig?: QualifiedVendorConfig;
  /** Single canonical preferred acquisition method — same set as
   *  acquisitionMethods but exactly one entry, used by procurement
   *  to default new POs. Mirrors the Items Library column spec. */
  preferredAcquisition: "Purchased" | "Manufactured" | "Purchase";
  /** ISO date the item record was created. */
  createdOn: string;
  /** User who created the record. Full team-member shape so the
   *  cell can render a photo avatar + hover business-card. */
  createdBy: ItemTeamMember;
  /** Current item owner — same shape as createdBy. */
  owner: ItemTeamMember;
  status: "Active" | "Inactive";
  tradeDirection: "sell" | "purchase" | "both";
  image: string;
  hasBlueDot: boolean;
  /** Restricted items can only be bought by partners explicitly approved
   *  for them. Drives the "Approved to Buy" filter on the partner-detail
   *  Items They Buy sub-tab and the "Restricted only" default in the Add
   *  Approved Buyer modal. Unrestricted items are open to every partner. */
  isRestricted: boolean;
  /** Why the item is restricted, when isRestricted=true. VMI = Vendor-
   *  Managed Inventory; Hazmat = regulated/hazardous; Contract-only =
   *  bound to a specific partner contract. null/undefined when the item
   *  is unrestricted. */
  restrictionScheme?: "VMI" | "Hazmat" | "Contract-only" | null;
}

// Sample team-member roster used for createdBy / owner avatars.
// Mirrors the Partners listing pattern: same colors as the canonical
// createdByContact set in vendors.ts, real photos via randomuser.me
// (matches getPersonAvatar in VendorsListPage), plus contextual
// role/email/phone for the hover card business-card preview.
type ItemTeamMember = {
  name: string;
  initials: string;
  bgColor: string;
  photoUrl: string;
  role: string;
  email: string;
  phone: string;
  contactId: string;
};
const ITEM_TEAM_MEMBERS: ItemTeamMember[] = [
  { name: "Ahtisham Ahmad",  initials: "AA", bgColor: "#6366f1", photoUrl: "/avatars/ahtisham-ahmad.jpg", role: "Procurement Lead",   email: "ahtisham.ahmad@company.com",  phone: "(412) 555-0142", contactId: "ahtisham-ahmad" },
  { name: "Mahreen Ghafoor", initials: "MG", bgColor: "#10b981", photoUrl: "/avatars/mahreen-ghafoor.png", role: "Supply Chain Manager", email: "mahreen.ghafoor@company.com", phone: "(412) 555-0167", contactId: "mahreen-ghafoor" },
  { name: "Eli Rosenbloom",  initials: "ER", bgColor: "#8b5cf6", photoUrl: "/avatars/eli-rosenbloom.png", role: "Operations Director",  email: "eli.rosenbloom@company.com",  phone: "(412) 555-0199", contactId: "eli-rosenbloom" },
  { name: "Nophil Anwer",    initials: "NA", bgColor: "#f59e0b", photoUrl: "/avatars/nophil-anwer.png", role: "Logistics Coordinator", email: "nophil.anwer@company.com",    phone: "(412) 555-0211", contactId: "nophil-anwer" },
  { name: "Irtaza Abid",     initials: "IA", bgColor: "#ef4444", photoUrl: "/avatars/irtaza-abid.jpg", role: "Finance Supervisor",   email: "irtaza.abid@company.com",     phone: "(412) 555-0234", contactId: "irtaza-abid" },
  { name: "Maya Patel",      initials: "MP", bgColor: "#ec4899", photoUrl: "https://randomuser.me/api/portraits/women/33.jpg", role: "Quality Lead",        email: "maya.patel@company.com",   phone: "(412) 555-0255", contactId: "maya-patel" },
  { name: "Liam Chen",       initials: "LC", bgColor: "#14b8a6", photoUrl: "https://randomuser.me/api/portraits/men/85.jpg", role: "Engineering Analyst", email: "liam.chen@company.com",       phone: "(412) 555-0276", contactId: "liam-chen" },
];

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const ITEM_TYPES = ["Parts", "Equipment - Capital", "Equipment - Non-Capital", "Miscellaneous"] as const;

const STOCK_STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "In Stock": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Low Stock": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  "Out of Stock": { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};

const ACQ_BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Purchased": { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF" },
  "Manufactured": { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
  "Purchase": { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF" },
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Active": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Inactive": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

const ITEM_IMAGES = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZXglMjBib2x0JTIwc2NyZXclMjBoYXJkd2FyZXxlbnwxfHx8fDE3NzMyNDY5OTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMGJhbGwlMjB2YWx2ZSUyMHBsdW1iaW5nfGVufDF8fHx8MTc3MzI0Njk5OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxydWJiZXIlMjBvLXJpbmclMjBzZWFsJTIwZ2Fza2V0fGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmQlMjBtaWxsJTIwY3V0dGluZyUyMHRvb2wlMjBjYXJiaWRlfGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHVtaW51bSUyMHNoZWV0JTIwbWV0YWwlMjBpbmR1c3RyaWFsfGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxsJTIwYmVhcmluZyUyMG1lY2hhbmljYWwlMjBjb21wb25lbnR8ZW58MXx8fHwxNzczMjQ2OTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
];

const ITEM_DEFS = [
  { partNo: "FAST-HEX-001", desc: "Zinc-Plated Hex Head Screw, 1/4\"-20 x 1\"", mfr: "BoltMaster Inc.", sku: "BM-2520-100", cat: "Fasteners", addCat: "Hardware", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 15400, unit: "EA", alt: "Box (100)", inLoc: "Warehouse A, Row 01, Sh...", outLoc: "Warehouse A, Row 01, Sh...", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "VALV-BAL-316", desc: "316 Stainless Steel Ball Valve, 2-Piece, 1\"", mfr: "FlowControl", sku: "SS-BV-100", cat: "Plumbing", addCat: "Industrial", ctrl: "Serialized" as const, stock: "Low Stock" as const, onHand: 12, unit: "EA", alt: "Carton (10)", inLoc: "Warehouse B, Row 04, Sh...", outLoc: "Warehouse B, Row 04, Sh...", acq: ["Purchased", "Manufactured"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "SEAL-OR-012", desc: "Buna-N O-Ring, Dash Number 012, Hard", mfr: "SealTech", sku: "BN-70-012", cat: "Seals", addCat: "Rubber Goods", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 5000, unit: "PK", alt: "Bag (100)", inLoc: "Warehouse C, Bin 12", outLoc: "Warehouse C, Bin 12", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "TOOL-EM-050", desc: "Solid Carbide Square End Mill, 1/2\" Cutti", mfr: "PrecisionTools", sku: "SC-EM-4F-500", cat: "Tools", addCat: "Carbide", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 45, unit: "EA", alt: "Tube (1)", inLoc: "Tool Room, Cabinet 5, Dra...", outLoc: "Tool Room, Cabinet 5, Dra...", acq: ["Purchase"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "MAT-AL-6061", desc: "6061-T6 Aluminum Sheet, 12\" x 24\" x 0.", mfr: "AluSupply", sku: "AL-6061-125", cat: "Raw Materials", addCat: "Sheet Stock", ctrl: "Non-Serialized" as const, stock: "Out of Stock" as const, onHand: 0, unit: "SH", alt: "Pallet (50)", inLoc: "Yard, Rack 01", outLoc: "Yard, Rack 01", acq: ["Purchased", "Manufactured"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "MECH-BRG-6204", desc: "Deep Groove Ball Bearing, 6204-2RS, St", mfr: "MotionPro", sku: "6204-2RS", cat: "Power Trans", addCat: "Mechanical", ctrl: "Serialized" as const, stock: "In Stock" as const, onHand: 240, unit: "EA", alt: "Box (10)", inLoc: "Parts Room, Row 02, Bin 12", outLoc: "Parts Room, Row 02, Bin 12", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
];

const EXTRA_DEFS = [
  { partNo: "ELEC-RLY-024", desc: "24V DC Relay, SPDT, 10A Contact Rating", mfr: "CircuitPro", sku: "RL-24-SPDT", cat: "Electrical", addCat: "Controls", ctrl: "Non-Serialized" as const },
  { partNo: "HYDR-CYL-350", desc: "Hydraulic Cylinder, 3.5\" Bore x 24\" Stroke", mfr: "HydraForce", sku: "HC-3524-D", cat: "Hydraulics", addCat: "Actuators", ctrl: "Serialized" as const },
  { partNo: "PNEU-FTG-038", desc: "Push-to-Connect Fitting, 3/8\" Tube OD", mfr: "AirLine", sku: "PTC-038-NPT", cat: "Pneumatics", addCat: "Fittings", ctrl: "Non-Serialized" as const },
  { partNo: "WELD-ROD-309", desc: "309L Stainless Welding Rod, 3/32\" x 36\"", mfr: "WeldPro", sku: "WR-309L-332", cat: "Welding", addCat: "Consumables", ctrl: "Non-Serialized" as const },
  { partNo: "ABRS-DSC-045", desc: "Flap Disc 4.5\" x 7/8\" Zirconia, 60 Grit", mfr: "GrindMaster", sku: "FD-45-Z60", cat: "Abrasives", addCat: "Discs", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-GLV-XL", desc: "Cut-Resistant Gloves, ANSI A4, XL, 12pk", mfr: "SafeHand", sku: "CR-A4-XL-12", cat: "Safety", addCat: "PPE", ctrl: "Non-Serialized" as const },
  { partNo: "LUBR-GRS-EP2", desc: "EP2 Lithium Complex Grease, 14oz Cart", mfr: "LubeTech", sku: "LC-EP2-14", cat: "Lubricants", addCat: "Grease", ctrl: "Non-Serialized" as const },
  { partNo: "FILT-HYD-010", desc: "Hydraulic Return Filter Element, 10 Micron", mfr: "FilterMax", sku: "HF-RET-10M", cat: "Filters", addCat: "Hydraulic", ctrl: "Non-Serialized" as const },
  { partNo: "BELT-VEE-B68", desc: "Classical V-Belt, B68, 71\" Outside Length", mfr: "DrivePro", sku: "VB-B68-71", cat: "Power Trans", addCat: "Belts", ctrl: "Non-Serialized" as const },
  { partNo: "SENS-PROX-M12", desc: "Inductive Proximity Sensor, M12, NPN, 4mm", mfr: "SenseLogic", sku: "IPS-M12-4N", cat: "Electrical", addCat: "Sensors", ctrl: "Serialized" as const },
  { partNo: "SPRI-COMP-25", desc: "Compression Spring, .750 OD x 2.5\" FL", mfr: "SpringWorks", sku: "CS-750-25", cat: "Hardware", addCat: "Springs", ctrl: "Non-Serialized" as const },
  { partNo: "SEAL-LIP-030", desc: "Double Lip Oil Seal, 30mm ID x 47mm OD", mfr: "SealTech", sku: "DL-3047-7", cat: "Seals", addCat: "Oil Seals", ctrl: "Non-Serialized" as const },
  { partNo: "CPLG-JAW-L99", desc: "Jaw Coupling Hub, L099, 3/4\" Bore, Keyway", mfr: "CouplingPro", sku: "JC-L99-075K", cat: "Power Trans", addCat: "Couplings", ctrl: "Non-Serialized" as const },
  { partNo: "CSTR-SWV-475", desc: "Heavy Duty Swivel Caster, 4\" x 2\", 750lb", mfr: "RollRight", sku: "HD-SWV-42", cat: "Material Handling", addCat: "Casters", ctrl: "Non-Serialized" as const },
  { partNo: "INSUL-FBR-R19", desc: "Fiberglass Insulation Batt, R-19, 6.25\"", mfr: "ThermoShield", sku: "FB-R19-23", cat: "Insulation", addCat: "Thermal", ctrl: "Non-Serialized" as const },
  { partNo: "PIPE-SS-150", desc: "304 Stainless Pipe, 1.5\" Sch 40, 20ft", mfr: "PipePro", sku: "SS304-150-40", cat: "Plumbing", addCat: "Pipe", ctrl: "Non-Serialized" as const },
  { partNo: "WIRE-THHN-12", desc: "THHN Wire, 12 AWG, Stranded, Black, 500ft", mfr: "WireTech", sku: "THHN-12-BK", cat: "Electrical", addCat: "Wire", ctrl: "Non-Serialized" as const },
  { partNo: "ADHV-EPXY-ST", desc: "Structural Epoxy Adhesive, 50ml Dual Cart", mfr: "BondMax", sku: "SE-50-DC", cat: "Adhesives", addCat: "Structural", ctrl: "Non-Serialized" as const },
  // Extended realistic items for 500+ total
  { partNo: "MOTR-AC-075", desc: "AC Induction Motor, 3/4 HP, 1725 RPM, TEFC", mfr: "MotorDrive", sku: "AC-075-TEFC", cat: "Motors", addCat: "AC Motors", ctrl: "Serialized" as const },
  { partNo: "PUMP-CENT-200", desc: "Centrifugal Pump, 2\" NPT, Cast Iron, 5HP", mfr: "FlowMaster", sku: "CP-200-CI5", cat: "Pumps", addCat: "Centrifugal", ctrl: "Serialized" as const },
  { partNo: "VALV-SOL-12V", desc: "12V DC Solenoid Valve, 2-Way, 1/4\" NPT", mfr: "FlowControl", sku: "SV-12V-025", cat: "Valves", addCat: "Solenoid", ctrl: "Non-Serialized" as const },
  { partNo: "BEAR-PILL-204", desc: "Pillow Block Bearing, UCP204, 20mm Bore", mfr: "MotionPro", sku: "UCP204-20", cat: "Bearings", addCat: "Mounted", ctrl: "Serialized" as const },
  { partNo: "GEAR-SPUR-48P", desc: "Steel Spur Gear, 48 Pitch, 24 Teeth, 1/4\" Bore", mfr: "GearWorks", sku: "SG-48P-24T", cat: "Power Trans", addCat: "Gears", ctrl: "Non-Serialized" as const },
  { partNo: "CHAIN-RLR-40", desc: "Roller Chain, #40, Single Strand, 10ft", mfr: "ChainPro", sku: "RC-40-10FT", cat: "Power Trans", addCat: "Chains", ctrl: "Non-Serialized" as const },
  { partNo: "SPKT-40B-15", desc: "Sprocket, #40 Chain, 15 Teeth, 5/8\" Bore", mfr: "ChainPro", sku: "SP-40B-15T", cat: "Power Trans", addCat: "Sprockets", ctrl: "Non-Serialized" as const },
  { partNo: "CYLD-PNEU-32", desc: "Pneumatic Cylinder, 32mm Bore, 100mm Stroke", mfr: "AirLine", sku: "PC-32-100", cat: "Pneumatics", addCat: "Cylinders", ctrl: "Serialized" as const },
  { partNo: "GASK-SPIR-4IN", desc: "Spiral Wound Gasket, 4\" 150#, 304/Graphite", mfr: "SealTech", sku: "SWG-4-150", cat: "Seals", addCat: "Gaskets", ctrl: "Non-Serialized" as const },
  { partNo: "FLNG-WN-4IN", desc: "Weld Neck Flange, 4\" 150#, A105 Carbon Steel", mfr: "PipePro", sku: "WNF-4-150", cat: "Plumbing", addCat: "Flanges", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-CB-30A", desc: "Miniature Circuit Breaker, 30A, 2-Pole, C-Curve", mfr: "CircuitPro", sku: "MCB-30A-2P", cat: "Electrical", addCat: "Breakers", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-VFD-5HP", desc: "Variable Frequency Drive, 5HP, 480V, 3-Phase", mfr: "MotorDrive", sku: "VFD-5HP-480", cat: "Electrical", addCat: "Drives", ctrl: "Serialized" as const },
  { partNo: "TOOL-TAP-M10", desc: "Spiral Point Tap, M10 x 1.5, HSS-E TiN Coated", mfr: "PrecisionTools", sku: "SPT-M10-15", cat: "Tools", addCat: "Threading", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-DRL-8MM", desc: "Cobalt Jobber Drill Bit, 8mm, 135-Degree Split Pt", mfr: "PrecisionTools", sku: "CDB-8MM-135", cat: "Tools", addCat: "Drill Bits", ctrl: "Non-Serialized" as const },
  { partNo: "ABRS-BELT-36", desc: "Sanding Belt, 4\" x 36\", Aluminum Oxide, 80 Grit", mfr: "GrindMaster", sku: "SB-436-80", cat: "Abrasives", addCat: "Belts", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-HELM-WHT", desc: "Hard Hat, Type I Class E, Ratchet Adjust, White", mfr: "SafeHand", sku: "HH-TI-CE-W", cat: "Safety", addCat: "Head Protection", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-GOGL-AF", desc: "Safety Goggles, Anti-Fog, Indirect Vent, Clear", mfr: "SafeHand", sku: "SG-AF-CLR", cat: "Safety", addCat: "Eye Protection", ctrl: "Non-Serialized" as const },
  { partNo: "LUBR-OIL-HYD", desc: "Hydraulic Oil AW-46, 5 Gallon Pail", mfr: "LubeTech", sku: "HO-AW46-5G", cat: "Lubricants", addCat: "Oils", ctrl: "Non-Serialized" as const },
  { partNo: "FILT-AIR-HEPA", desc: "HEPA Air Filter, 24\" x 24\" x 12\", 99.97%", mfr: "FilterMax", sku: "HEPA-2424-12", cat: "Filters", addCat: "Air Filters", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-SS-316L", desc: "316L Stainless Round Bar, 1\" Dia x 6ft", mfr: "AluSupply", sku: "SS316L-1R-6", cat: "Raw Materials", addCat: "Round Bar", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-CU-110", desc: "C110 Copper Sheet, 12\" x 12\" x 0.032\"", mfr: "AluSupply", sku: "CU110-12-032", cat: "Raw Materials", addCat: "Sheet Stock", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-SOC-M8", desc: "Socket Head Cap Screw, M8 x 1.25 x 30mm, A2", mfr: "BoltMaster Inc.", sku: "SHCS-M8-30", cat: "Fasteners", addCat: "Socket Head", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-NUT-M12", desc: "Hex Nut, M12 x 1.75, Grade 8, Zinc Plated", mfr: "BoltMaster Inc.", sku: "HN-M12-G8", cat: "Fasteners", addCat: "Nuts", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-WSHR-516", desc: "Flat Washer, 5/16\", SAE, Zinc Plated, 100pk", mfr: "BoltMaster Inc.", sku: "FW-516-100", cat: "Fasteners", addCat: "Washers", ctrl: "Non-Serialized" as const },
  { partNo: "HOSE-HYD-38", desc: "Hydraulic Hose, 3/8\" ID, 4000 PSI, 10ft", mfr: "HydraForce", sku: "HH-38-4K-10", cat: "Hydraulics", addCat: "Hoses", ctrl: "Non-Serialized" as const },
  { partNo: "CONTR-PLC-16", desc: "Micro PLC, 16 I/O, Ethernet, 24V DC", mfr: "SenseLogic", sku: "MPLC-16IO-E", cat: "Electrical", addCat: "PLCs", ctrl: "Serialized" as const },
  { partNo: "CONTR-HMI-7IN", desc: "HMI Touch Panel, 7\" Color TFT, Ethernet", mfr: "SenseLogic", sku: "HMI-7C-ETH", cat: "Electrical", addCat: "HMIs", ctrl: "Serialized" as const },
  { partNo: "WELD-WIRE-ER70", desc: "MIG Wire ER70S-6, .035\", 33lb Spool", mfr: "WeldPro", sku: "MW-ER70-035", cat: "Welding", addCat: "MIG Wire", ctrl: "Non-Serialized" as const },
  { partNo: "WELD-GAS-C25", desc: "Shielding Gas C25, 75% Ar / 25% CO2, 80cf", mfr: "WeldPro", sku: "SG-C25-80CF", cat: "Welding", addCat: "Gas", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-HDPE-SHT", desc: "HDPE Sheet, Natural, 1/2\" x 24\" x 48\"", mfr: "ThermoShield", sku: "HDPE-12-2448", cat: "Raw Materials", addCat: "Plastics", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-XFMR-1KV", desc: "Control Transformer, 1KVA, 480V to 120V", mfr: "CircuitPro", sku: "CT-1KVA-480", cat: "Electrical", addCat: "Transformers", ctrl: "Serialized" as const },
  { partNo: "TOOL-REAM-10", desc: "Chucking Reamer, 10mm, HSS, Straight Flute", mfr: "PrecisionTools", sku: "CR-10MM-HSS", cat: "Tools", addCat: "Reamers", ctrl: "Non-Serialized" as const },
  { partNo: "PNEU-REG-14", desc: "Air Pressure Regulator, 1/4\" NPT, 0-150 PSI", mfr: "AirLine", sku: "APR-14-150", cat: "Pneumatics", addCat: "Regulators", ctrl: "Non-Serialized" as const },
  { partNo: "PNEU-TUBE-8", desc: "Polyurethane Tubing, 8mm OD, Blue, 100m", mfr: "AirLine", sku: "PU-8MM-BL", cat: "Pneumatics", addCat: "Tubing", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-NYLON-ROD", desc: "Nylon 6/6 Rod, 2\" Dia x 4ft, Natural", mfr: "ThermoShield", sku: "NY66-2R-4FT", cat: "Raw Materials", addCat: "Plastics", ctrl: "Non-Serialized" as const },
  { partNo: "BEAR-THRST-512", desc: "Thrust Ball Bearing, 51200 Series, 10mm ID", mfr: "MotionPro", sku: "TB-51200-10", cat: "Bearings", addCat: "Thrust", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-RVET-316", desc: "Pop Rivet, 3/16\" x 1/4\", Aluminum, 500pk", mfr: "BoltMaster Inc.", sku: "PR-316-500", cat: "Fasteners", addCat: "Rivets", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-CNDL-34", desc: "Rigid Conduit, 3/4\", Galvanized Steel, 10ft", mfr: "WireTech", sku: "RC-34-GS-10", cat: "Electrical", addCat: "Conduit", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-CLMP-6IN", desc: "Bar Clamp, 6\" Capacity, Quick-Release", mfr: "PrecisionTools", sku: "BC-6QR", cat: "Tools", addCat: "Clamps", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-RESP-P100", desc: "Half Facepiece Respirator, P100 Filters, Med", mfr: "SafeHand", sku: "HFR-P100-M", cat: "Safety", addCat: "Respiratory", ctrl: "Non-Serialized" as const },
  { partNo: "HYDR-FILT-RET", desc: "Hydraulic Return Line Filter, 25 Micron, 3/4\"", mfr: "FilterMax", sku: "HRL-25M-075", cat: "Filters", addCat: "Hydraulic", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-BRASS-360", desc: "360 Brass Hex Bar, 3/4\" AF x 3ft", mfr: "AluSupply", sku: "BR360-075H", cat: "Raw Materials", addCat: "Hex Bar", ctrl: "Non-Serialized" as const },
  { partNo: "MOTR-SERV-400", desc: "AC Servo Motor, 400W, 3000 RPM, w/ Encoder", mfr: "MotorDrive", sku: "SRV-400W-3K", cat: "Motors", addCat: "Servo", ctrl: "Serialized" as const },
  { partNo: "PUMP-DIAP-1IN", desc: "Air-Operated Diaphragm Pump, 1\" Poly, 53 GPM", mfr: "FlowMaster", sku: "DP-1P-53GPM", cat: "Pumps", addCat: "Diaphragm", ctrl: "Serialized" as const },
  { partNo: "VALV-GATE-2IN", desc: "Gate Valve, 2\", 150# Flanged, WCB Body", mfr: "FlowControl", sku: "GV-2-150-WCB", cat: "Valves", addCat: "Gate", ctrl: "Non-Serialized" as const },
  { partNo: "ADHV-THREAD-M", desc: "Medium Strength Threadlocker, Blue, 50ml", mfr: "BondMax", sku: "TL-MED-BL-50", cat: "Adhesives", addCat: "Threadlocker", ctrl: "Non-Serialized" as const },
  { partNo: "INSUL-TAPE-EL", desc: "Electrical Tape, 3/4\" x 66ft, Black, 10pk", mfr: "WireTech", sku: "ET-075-66-10", cat: "Insulation", addCat: "Tape", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-WRCH-SET", desc: "Combination Wrench Set, 12pc, SAE, Chrome", mfr: "PrecisionTools", sku: "CWS-12SAE", cat: "Tools", addCat: "Wrenches", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-SOCK-38", desc: "Socket Set, 3/8\" Drive, 22pc, 6-Point, Metric", mfr: "PrecisionTools", sku: "SS-38-22M", cat: "Tools", addCat: "Sockets", ctrl: "Non-Serialized" as const },
];

const ALT_UNITS_LIST = ["Box (100)", "Carton (10)", "Bag (100)", "Tube (1)", "Pallet (50)", "Box (10)", "Case (24)", "Pack (12)", "Drum (55 gal)", "Spool (1,000 ft)"];

/** Units of measure offered in the Configure Vendor Details UOM dropdown.
 *  Same set as the canonical item-detail "Each / Box / Case / Pallet …"
 *  picker so the two surfaces stay aligned. */
/** UOM options with optional short-form symbol/abbreviation, mirrors
 *  the canonical item-detail "Each / Box / Case / Pallet …" picker
 *  pattern. Symbols are surfaced inline in the dropdown so the user
 *  sees both the long name and the shorthand they'd use on a PO. */
/* Numeric-input filter for the Item Configuration + bulk-apply fields.
 * Strips any character that isn't a digit (and optionally a single
 * decimal point) so the user can't paste / type letters into a field
 * that's supposed to hold a quantity, price, percentage, or day count.
 * Used by both the per-item Configure step and the Apply-to-all
 * popover — the trade-direction fields, Pricing Rules, etc. are left
 * alone since they accept text intentionally. */
function numericInput(raw: string, opts: { decimal?: boolean } = {}): string {
  if (opts.decimal) {
    // Keep digits + at most one decimal point.
    const stripped = raw.replace(/[^0-9.]/g, "");
    const firstDot = stripped.indexOf(".");
    if (firstDot < 0) return stripped;
    // Drop any extra dots that come after the first.
    return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, "");
  }
  return raw.replace(/[^0-9]/g, "");
}

/** "Defined Alternatives" — the canonical short-list of UoMs the user
 *  expects to find first when picking a pricing unit. Surfaced at the
 *  top of the searchable picker. */
const QV_UOM_OPTIONS: { id: string; label: string; symbol: string }[] = [
  { id: "Each", label: "Each", symbol: "EA" },
  { id: "Box", label: "Box", symbol: "BX" },
  { id: "Case", label: "Case", symbol: "CS" },
  { id: "Pallet", label: "Pallet", symbol: "PLT" },
  { id: "Kg", label: "Kilogram", symbol: "kg" },
  { id: "lb", label: "Pound", symbol: "lb" },
  { id: "Liter", label: "Liter", symbol: "L" },
  { id: "Roll", label: "Roll", symbol: "RL" },
  { id: "Pair", label: "Pair", symbol: "PR" },
  { id: "Foot", label: "Foot", symbol: "ft" },
  { id: "Meter", label: "Meter", symbol: "m" },
];

/** All other indexable units — anything that maps to a base unit via
 *  the global conversion table. In production this list ships from the
 *  units service; for now we hard-code the canonical roster so the
 *  picker surface (Defined Alternatives + Indexable Units) is testable
 *  end-to-end. Each unit is grouped by base measure (count / mass /
 *  volume / length / area / time) so the search picker can render the
 *  group label on each row. */
const QV_UOM_ALL_INDEXABLE: { id: string; label: string; symbol: string; group: string }[] = [
  // Count
  { id: "Dozen", label: "Dozen", symbol: "DZ", group: "Count" },
  { id: "Gross", label: "Gross", symbol: "GRO", group: "Count" },
  { id: "Pack", label: "Pack", symbol: "PK", group: "Count" },
  { id: "Carton", label: "Carton", symbol: "CTN", group: "Count" },
  { id: "Bundle", label: "Bundle", symbol: "BDL", group: "Count" },
  { id: "Set", label: "Set", symbol: "SET", group: "Count" },
  { id: "Sheet", label: "Sheet", symbol: "SH", group: "Count" },
  { id: "Unit", label: "Unit", symbol: "U", group: "Count" },
  // Mass
  { id: "Gram", label: "Gram", symbol: "g", group: "Mass" },
  { id: "Milligram", label: "Milligram", symbol: "mg", group: "Mass" },
  { id: "Ton", label: "Metric Ton", symbol: "t", group: "Mass" },
  { id: "Ounce", label: "Ounce", symbol: "oz", group: "Mass" },
  { id: "STon", label: "Short Ton", symbol: "ton", group: "Mass" },
  // Volume
  { id: "Milliliter", label: "Milliliter", symbol: "mL", group: "Volume" },
  { id: "Gallon", label: "Gallon", symbol: "gal", group: "Volume" },
  { id: "Quart", label: "Quart", symbol: "qt", group: "Volume" },
  { id: "Pint", label: "Pint", symbol: "pt", group: "Volume" },
  { id: "FluidOz", label: "Fluid Ounce", symbol: "fl oz", group: "Volume" },
  { id: "Barrel", label: "Barrel", symbol: "bbl", group: "Volume" },
  { id: "CubicFt", label: "Cubic Foot", symbol: "ft³", group: "Volume" },
  { id: "CubicM", label: "Cubic Meter", symbol: "m³", group: "Volume" },
  // Length
  { id: "Millimeter", label: "Millimeter", symbol: "mm", group: "Length" },
  { id: "Centimeter", label: "Centimeter", symbol: "cm", group: "Length" },
  { id: "Inch", label: "Inch", symbol: "in", group: "Length" },
  { id: "Yard", label: "Yard", symbol: "yd", group: "Length" },
  { id: "Mile", label: "Mile", symbol: "mi", group: "Length" },
  { id: "Kilometer", label: "Kilometer", symbol: "km", group: "Length" },
  // Area
  { id: "SqFt", label: "Square Foot", symbol: "ft²", group: "Area" },
  { id: "SqMeter", label: "Square Meter", symbol: "m²", group: "Area" },
  { id: "SqYard", label: "Square Yard", symbol: "yd²", group: "Area" },
  { id: "Acre", label: "Acre", symbol: "ac", group: "Area" },
  // Time
  { id: "Hour", label: "Hour", symbol: "h", group: "Time" },
  { id: "Day", label: "Day", symbol: "d", group: "Time" },
  { id: "Month", label: "Month", symbol: "mo", group: "Time" },
];

/** Lookup the display label/symbol for any UoM id across both the
 *  Defined Alternatives + Indexable Units rosters. Falls back to the
 *  raw id if the caller passes something we don't know (e.g. a unit
 *  the production service has but our mock doesn't). */
function lookupUom(id: string): { id: string; label: string; symbol: string } {
  const defined = QV_UOM_OPTIONS.find((u) => u.id === id);
  if (defined) return defined;
  const indexable = QV_UOM_ALL_INDEXABLE.find((u) => u.id === id);
  if (indexable) return { id: indexable.id, label: indexable.label, symbol: indexable.symbol };
  return { id, label: id, symbol: id };
}

/** Maps the short stocking units used on the inventory rows (ea, pk, sh, …)
 *  to the human UOM dropdown labels so picking an item pre-selects a
 *  sensible default. */
const ON_HAND_UNIT_TO_UOM: Record<string, string> = {
  EA: "Each",
  PK: "Pack",
  SH: "Sheet",
  ft: "Foot",
  lb: "lb",
  gal: "Liter",
};

/** Pricing-rule shape used across the Configure step. Presets are
 *  shared rules (used by other partners too); `custom: true` marks
 *  partner-scoped rules created or copied inside the qualification
 *  flow — those never trigger the shared-rule edit warning. */
type QvPricingRule = { id: string; label: string; subtitle: string; type: "discount" | "premium"; custom?: boolean };

/** Placeholder pricing-rule presets for the Configure step.
 *  Sourced from the partner-level Pricing Rules tab in production. */
const QV_PRICING_RULE_PRESETS: QvPricingRule[] = [
  { id: "early-pay-2-10", label: "Early Payment Discount · 2/10", subtitle: "2% off if paid in 10 days", type: "discount" },
  { id: "volume-tier-100", label: "Volume Tier · 100+ units", subtitle: "5% off on orders of 100+ units", type: "discount" },
  { id: "fuel-surcharge", label: "Fuel Surcharge · 3.5%", subtitle: "Applied on freight invoices", type: "premium" },
];

/** Pricing-rule ids inherited from the partner level by default. In
 *  production this would be read from the partner's applied rules
 *  list; for now we seed the two discount rules so the Configure
 *  step ships with a concrete inherited example. */
const INHERITED_PARTNER_PRICING_RULE_IDS: string[] = ["early-pay-2-10", "volume-tier-100"];

/** Carrier-method ids inherited from the partner-level Freight &
 *  Logistics tab by default. Pulls FedEx + DHL primary methods so
 *  the section ships with concrete inherited cards out-of-the-box. */
const INHERITED_PARTNER_FREIGHT_METHOD_IDS: string[] = ["fedex-air", "dhl-express"];
const LOCATIONS = [
  "Warehouse A, Row 01, Sh...", "Warehouse B, Row 04, Sh...", "Warehouse C, Bin 12",
  "Tool Room, Cabinet 5, Dra...", "Yard, Rack 01", "Parts Room, Row 02, Bin 12",
  "Warehouse D, Bin 08", "Maint Shop, Cabinet 3", "Receiving Dock 2",
];

// Seeded RNG for deterministic data
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Restriction-scheme assignment — deterministic from the item's partNo
 * so the same item always carries the same flag across renders / refs
 * (creator UI + Approved-Buyer modal + Items They Buy filter all see
 * the same truth). ~25% of items end up restricted; the rest stay open. */
const RESTRICTION_SCHEMES: ("VMI" | "Hazmat" | "Contract-only")[] = ["VMI", "Hazmat", "Contract-only"];
function hashStringForRestriction(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function deriveRestriction(partNo: string): { isRestricted: boolean; restrictionScheme: "VMI" | "Hazmat" | "Contract-only" | null } {
  const h = hashStringForRestriction(partNo);
  // 25% restricted — h % 4 === 0
  if (h % 4 !== 0) return { isRestricted: false, restrictionScheme: null };
  return { isRestricted: true, restrictionScheme: RESTRICTION_SCHEMES[h % RESTRICTION_SCHEMES.length] };
}

/* Per-partner approved-to-buy allowlist — deterministic mock of which
 * restricted items a partner is cleared to buy. Used by the partner-
 * detail Items They Buy "Approved to Buy" filter and the Add Approved
 * Buyer modal's "Other approved buyers" chip strip.
 *
 * Rule: a partner is approved for a given restricted item when
 *   hashStringForRestriction(partnerId + ":" + item.id) % 3 === 0
 * — gives a stable spread (~33% of restricted items per partner) without
 * needing a real allowlist store. Locations inherit their partner's
 * allowlist; locations override by id prefix when we want a divergent
 * sample (out of scope for the first push). */
export function isPartnerApprovedToBuy(partnerId: string, item: PartnerItemData): boolean {
  if (!item.isRestricted) return false;
  return hashStringForRestriction(`${partnerId}:${item.id}`) % 3 === 0;
}

/* Other partners approved for the same restricted item — used by the
 * Add Approved Buyer modal to surface "other approved buyers" so the
 * user can copy an allowlist across partners (the "grant access to all
 * VMI parts" flow). Returns up to `limit` partner ids/names. */
export function getOtherApprovedBuyers(itemId: string, item: PartnerItemData, allPartners: { id: string; companyName: string; displayName: string }[], excludePartnerId: string, limit = 6): { id: string; name: string }[] {
  if (!item.isRestricted) return [];
  const out: { id: string; name: string }[] = [];
  for (const p of allPartners) {
    if (p.id === excludePartnerId) continue;
    if (hashStringForRestriction(`${p.id}:${itemId}`) % 3 === 0) {
      out.push({ id: p.id, name: p.displayName || p.companyName });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/* Other qualified vendors for an item — Eli's ask: show the user who
 * already supplies this item so they can size up where the new partner
 * slots in (priority, price, lead time). Seeded deterministically off
 * (itemId, vendorId) so reopening the modal produces the same roster.
 * Returns up to `limit` rows with priority 1..N assigned in roster
 * order; production reads the real qualified-vendor index per item. */
export interface OtherQualifiedVendor {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  profileImage?: string | null;
  priority: number;
  price: number;
  uom: string;
  leadTimeDays: number;
}
const _otherQvCache = new Map<string, OtherQualifiedVendor[]>();
export function getOtherQualifiedVendors(
  itemId: string,
  excludePartnerId: string,
  allVendors: { id: string; companyName: string; displayName: string; code: string; profileImage?: string | null }[],
  limit = 4
): OtherQualifiedVendor[] {
  const cacheKey = `${itemId}:${excludePartnerId}:${allVendors.length}`;
  const cached = _otherQvCache.get(cacheKey);
  if (cached) return cached;
  const rng = seededRng(hashStringForRestriction(`qv-roster:${itemId}`) || 1);
  const uoms = ["Each", "Box", "Case", "Pallet"];
  const out: OtherQualifiedVendor[] = [];
  for (const v of allVendors) {
    if (v.id === excludePartnerId) continue;
    /* ~35% of the active vendor roster is a qualified vendor for any
     * given item — enough density that most items show 2-4 cards, few
     * show zero. */
    if (hashStringForRestriction(`qv:${v.id}:${itemId}`) % 100 < 35) {
      out.push({
        vendorId: v.id,
        vendorName: v.displayName || v.companyName,
        vendorCode: v.code,
        profileImage: v.profileImage,
        priority: 0,
        price: Number((rng() * 180 + 5).toFixed(2)),
        uom: uoms[Math.floor(rng() * uoms.length)],
        leadTimeDays: Math.floor(rng() * 14) + 1,
      });
      if (out.length >= limit) break;
    }
  }
  out.forEach((v, i) => { v.priority = i + 1; });
  _otherQvCache.set(cacheKey, out);
  return out;
}

/* Deterministic purchase-history seed. For each (partner, item) pair
 * the partner actually buys (~40% of their items), emits 1-5 PO lines
 * with date / qty / unit price / PO number. Cached per partnerId so
 * downstream renders hit memoized data. Replace with the real
 * transactions feed when the POs module surfaces it. */
export type PurchaseHistoryLine = {
  id: string;
  poNumber: string;
  date: string;
  qty: number;
  unitPrice: number;
  totalSpend: number;
  /** True when the PO/SO behind this line was cancelled — surfaced via
   *  the "Cancelled POs/SOs" quick filter on the Transactions tab. */
  cancelled?: boolean;
};
export type PurchaseHistoryRow = {
  item: PartnerItemData;
  totalQty: number;
  totalSpend: number;
  poCount: number;
  lastDate: string;
  lastPoNumber: string;
  lines: PurchaseHistoryLine[];
};

const _purchaseHistoryCache = new Map<string, PurchaseHistoryRow[]>();
export function getPurchaseHistoryForPartner(partnerId: string, items: PartnerItemData[]): PurchaseHistoryRow[] {
  const cacheKey = `${partnerId}:${items.length}`;
  const cached = _purchaseHistoryCache.get(cacheKey);
  if (cached) return cached;
  const rng = seededRng(hashStringForRestriction(partnerId) || 1);
  const rows: PurchaseHistoryRow[] = [];
  for (const item of items) {
    // ~40% of catalog items show up in any given partner's history.
    if (hashStringForRestriction(`${partnerId}:hist:${item.id}`) % 5 >= 2) continue;
    const poCount = 1 + Math.floor(rng() * 5);
    const lines: PurchaseHistoryLine[] = [];
    let totalQty = 0;
    let totalSpend = 0;
    for (let i = 0; i < poCount; i++) {
      const daysAgo = Math.floor(rng() * 360);
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const qty = Math.max(1, Math.floor(rng() * 480) + 10);
      const unitPrice = Number((rng() * 240 + 0.25).toFixed(2));
      const total = Number((qty * unitPrice).toFixed(2));
      totalQty += qty;
      totalSpend += total;
      lines.push({
        id: `${partnerId}-${item.id}-po-${i}`,
        poNumber: `PO-${(hashStringForRestriction(`${partnerId}:${item.id}:${i}`) % 90000 + 10000)}`,
        date,
        qty,
        unitPrice,
        totalSpend: total,
        // ~8% of the ledger is cancelled POs — deterministic per line.
        cancelled: hashStringForRestriction(`cancel:${partnerId}:${item.id}:po:${i}`) % 100 < 8,
      });
    }
    lines.sort((a, b) => (a.date < b.date ? 1 : -1));
    rows.push({
      item,
      totalQty,
      totalSpend: Number(totalSpend.toFixed(2)),
      poCount,
      lastDate: lines[0].date,
      lastPoNumber: lines[0].poNumber,
      lines,
    });
  }
  rows.sort((a, b) => b.totalSpend - a.totalSpend);
  _purchaseHistoryCache.set(cacheKey, rows);
  return rows;
}

/* Sales-direction history — mirrors the purchase generator (same row
 * shape so PurchaseHistoryView can render either without forking), but
 * seeded off a different namespace and tagged with SO- numbers so the
 * Sales chip surfaces an independent ledger from Purchases. The
 * `totalSpend` / `poCount` / `lastPoNumber` fields carry sales-side
 * semantics here (= revenue / SO count / last SO number); label
 * mapping is handled at render time. */
const _salesHistoryCache = new Map<string, PurchaseHistoryRow[]>();
export function getSalesHistoryForPartner(partnerId: string, items: PartnerItemData[]): PurchaseHistoryRow[] {
  const cacheKey = `${partnerId}:${items.length}`;
  const cached = _salesHistoryCache.get(cacheKey);
  if (cached) return cached;
  const rng = seededRng((hashStringForRestriction(partnerId) || 1) ^ 0x5A1E5);
  const rows: PurchaseHistoryRow[] = [];
  for (const item of items) {
    // Different inclusion gate from purchases — flips the bit so a
    // partner with rich purchase data lands on a different sales-side
    // catalog, not the same items relabeled.
    if (hashStringForRestriction(`${partnerId}:sales:${item.id}`) % 5 >= 2) continue;
    const soCount = 1 + Math.floor(rng() * 5);
    const lines: PurchaseHistoryLine[] = [];
    let totalQty = 0;
    let totalRevenue = 0;
    for (let i = 0; i < soCount; i++) {
      const daysAgo = Math.floor(rng() * 360);
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const qty = Math.max(1, Math.floor(rng() * 480) + 10);
      const unitPrice = Number((rng() * 240 + 0.25).toFixed(2));
      const total = Number((qty * unitPrice).toFixed(2));
      totalQty += qty;
      totalRevenue += total;
      lines.push({
        id: `${partnerId}-${item.id}-so-${i}`,
        poNumber: `SO-${(hashStringForRestriction(`${partnerId}:sales:${item.id}:${i}`) % 90000 + 10000)}`,
        date,
        qty,
        unitPrice,
        totalSpend: total,
        // ~8% of the ledger is cancelled SOs — deterministic per line.
        cancelled: hashStringForRestriction(`cancel:${partnerId}:${item.id}:so:${i}`) % 100 < 8,
      });
    }
    lines.sort((a, b) => (a.date < b.date ? 1 : -1));
    rows.push({
      item,
      totalQty,
      totalSpend: Number(totalRevenue.toFixed(2)),
      poCount: soCount,
      lastDate: lines[0].date,
      lastPoNumber: lines[0].poNumber,
      lines,
    });
  }
  rows.sort((a, b) => b.totalSpend - a.totalSpend);
  _salesHistoryCache.set(cacheKey, rows);
  return rows;
}

function generateItemsFromVendor(vendor: Vendor): PartnerItemData[] {
  const rng = seededRng(vendor.companyName.length * 31 + 7);
  const items: PartnerItemData[] = [];

  // First 6 use the detailed ITEM_DEFS
  for (let i = 0; i < ITEM_DEFS.length; i++) {
    const d = ITEM_DEFS[i];
    // Deterministic created/owner pickers so the same vendor always
    // sees the same row order — avoids state churn on re-render.
    const created = new Date(2024, (i * 13) % 12, ((i * 7) % 28) + 1);
    const createdBy = ITEM_TEAM_MEMBERS[i % ITEM_TEAM_MEMBERS.length];
    const owner = ITEM_TEAM_MEMBERS[(i * 3 + 2) % ITEM_TEAM_MEMBERS.length];
    items.push({
      id: `item-${d.partNo}-${i}`,
      partNo: d.partNo,
      description: d.desc,
      manufacturer: d.mfr,
      sku: d.sku,
      category: d.cat,
      additionalCategory: d.addCat,
      itemType: ITEM_TYPES[Math.floor(rng() * ITEM_TYPES.length)],
      itemControlType: d.ctrl,
      stockStatus: d.stock,
      onHand: d.onHand,
      onHandUnit: d.unit,
      altUnits: d.alt,
      inboundLocation: d.inLoc,
      outboundLocation: d.outLoc,
      acquisitionMethods: d.acq,
      preferredAcquisition: d.acq[0],
      createdOn: created.toISOString(),
      createdBy,
      owner,
      status: rng() > 0.1 ? "Active" : "Inactive",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(rng() * 3)],
      image: ITEM_IMAGES[i % ITEM_IMAGES.length],
      hasBlueDot: rng() > 0.6,
      ...deriveRestriction(d.partNo),
    });
  }

  // Generate 494 extra items (total ~500) using EXTRA_DEFS + random data
  const extraCount = 494;
  for (let i = 0; i < extraCount; i++) {
    const r = rng;
    const def = EXTRA_DEFS[i % EXTRA_DEFS.length];
    const suffix = Math.floor(i / EXTRA_DEFS.length);
    const partNo = suffix === 0 ? def.partNo : `${def.partNo}-${String(suffix).padStart(2, "0")}`;
    const stockStatuses: ("In Stock" | "Low Stock" | "Out of Stock")[] = ["In Stock", "In Stock", "In Stock", "Low Stock", "Out of Stock"];
    const acqOptions: ("Purchased" | "Manufactured" | "Purchase")[][] = [
      ["Purchased"], ["Manufactured"], ["Purchased", "Manufactured"], ["Purchase"], ["Purchased"],
    ];
    const acquisitionMethods = acqOptions[Math.floor(r() * acqOptions.length)];
    const created = new Date(2024, Math.floor(r() * 12), Math.floor(r() * 28) + 1);
    const createdBy = ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)];
    const owner = ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)];
    items.push({
      id: `item-${partNo}-${i + 6}`,
      partNo,
      description: def.desc,
      manufacturer: def.partNo.split("-")[0] + "Corp",
      sku: def.sku,
      category: def.cat,
      additionalCategory: def.addCat,
      itemType: ITEM_TYPES[Math.floor(r() * ITEM_TYPES.length)],
      // Sprinkle ~20% of extra items as "Lot Controlled" so the new
      // quick filter has a non-trivial population to surface in both
      // sell + buy sub-tabs. The static seed at the top of the file
      // stays untouched.
      itemControlType: r() < 0.2 ? "Lot Controlled" : def.ctrl,
      stockStatus: stockStatuses[Math.floor(r() * stockStatuses.length)],
      onHand: Math.floor(r() * 20000),
      onHandUnit: (["EA", "PK", "SH", "ft", "lb", "gal"] as const)[Math.floor(r() * 6)],
      altUnits: ALT_UNITS_LIST[Math.floor(r() * ALT_UNITS_LIST.length)],
      inboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      outboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      acquisitionMethods,
      preferredAcquisition: acquisitionMethods[0],
      createdOn: created.toISOString(),
      createdBy,
      owner,
      status: r() > 0.12 ? "Active" : "Inactive",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(r() * 3)],
      image: ITEM_IMAGES[Math.floor(r() * ITEM_IMAGES.length)],
      hasBlueDot: r() > 0.65,
      ...deriveRestriction(partNo),
    });
  }

  return items;
}

// Inventory items for the "Add Item" modal
function generateInventoryItems(): PartnerItemData[] {
  const rng = seededRng(42);
  const items: PartnerItemData[] = [];
  const allDefs = [...EXTRA_DEFS.slice(6), ...EXTRA_DEFS, ...EXTRA_DEFS.slice(0, 6)];
  for (let i = 0; i < 60; i++) {
    const r = rng;
    const def = allDefs[i % allDefs.length];
    const partNo = `INV-${def.partNo.split("-").slice(0, 2).join("-")}-${String(i).padStart(3, "0")}`;
    items.push({
      id: `inv-${partNo}-${i}`,
      partNo,
      description: def.desc,
      manufacturer: def.partNo.split("-")[0] + "Corp",
      sku: def.sku,
      category: def.cat,
      additionalCategory: def.addCat,
      itemType: ITEM_TYPES[Math.floor(r() * ITEM_TYPES.length)],
      itemControlType: def.ctrl,
      stockStatus: r() > 0.3 ? "In Stock" : (r() > 0.5 ? "Low Stock" : "Out of Stock"),
      onHand: Math.floor(r() * 15000),
      onHandUnit: "EA",
      altUnits: ALT_UNITS_LIST[Math.floor(r() * ALT_UNITS_LIST.length)],
      inboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      outboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      acquisitionMethods: ["Purchased"],
      preferredAcquisition: "Purchased",
      createdOn: new Date(2024, Math.floor(r() * 12), Math.floor(r() * 28) + 1).toISOString(),
      createdBy: ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)],
      owner: ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)],
      status: "Active",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(r() * 3)],
      image: ITEM_IMAGES[Math.floor(r() * ITEM_IMAGES.length)],
      hasBlueDot: false,
      ...deriveRestriction(partNo),
    });
  }
  return items;
}

const INVENTORY_ITEMS = generateInventoryItems();

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

/* Helper-text icon that sits next to a form field label and reveals
 * a one-line description on hover. Used inside the Configure Pricing
 * accordion to explain Priority / Price / Min-Max / Deviation / Lead-
 * Time without bloating the layout. */
/** Searchable UoM picker — replaces the native Select on every UoM
 *  field in the QV flow. Surfaces "Defined Alternatives" first, then
 *  groups all other indexable units by base measure (count, mass,
 *  volume, length, area, time) so the user can type "kg" and land on
 *  the right unit even when it isn't in the canonical short-list.
 *  `disabledIds` lets the parent gray out units already claimed by
 *  another tier so the same UoM can't be picked twice on the same row. */
function UomPicker({
  value,
  onChange,
  disabledIds = new Set<string>(),
  triggerClassName = "",
  variant = "default",
}: {
  value: string;
  onChange: (next: string) => void;
  disabledIds?: Set<string>;
  triggerClassName?: string;
  variant?: "default" | "embedded";
}) {
  const [open, setOpen] = React.useState(false);
  /* Live search-query mirror so we can render yellow highlights on
   * the matching substring inside each unit row. cmdk filters the
   * list for us; this state just powers the visual mark-up. */
  const [search, setSearch] = React.useState("");
  React.useEffect(() => { if (!open) setSearch(""); }, [open]);
  const selected = lookupUom(value);
  /* Highlight the matching portion of `text` against the current
   * search query. Case-insensitive single-substring match — same
   * behavior cmdk's fuzzy filter uses for sort ordering. */
  const highlight = React.useCallback((text: string) => {
    if (!search) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = search.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-100 text-foreground rounded-sm">
          {text.slice(idx, idx + search.length)}
        </mark>
        {text.slice(idx + search.length)}
      </>
    );
  }, [search]);
  /* Hide Defined-Alternatives entries from the Indexable section so
   * the user doesn't see two rows for "Kilogram" etc. Grouped + sorted
   * alphabetically inside each base-measure group. */
  const definedIds = React.useMemo(() => new Set(QV_UOM_OPTIONS.map((u) => u.id)), []);
  const indexableByGroup = React.useMemo(() => {
    const map = new Map<string, typeof QV_UOM_ALL_INDEXABLE>();
    QV_UOM_ALL_INDEXABLE.filter((u) => !definedIds.has(u.id)).forEach((u) => {
      const list = map.get(u.group) || [];
      list.push(u);
      map.set(u.group, list);
    });
    map.forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [definedIds]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center justify-between gap-2 ${variant === "embedded"
            ? "h-9 text-[12px] w-[130px] border-0 border-l border-border rounded-none bg-[#FAFBFC] px-3"
            : "h-8 text-[12px] w-full rounded-md border border-border bg-white hover:border-slate-300 px-3"} ${triggerClassName}`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">{selected.label}</span>
            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{selected.symbol}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverPrimitive.Content
        align="end"
        sideOffset={6}
        /* Wider surface + flex column so the sticky footer ("Create
         * new unit") doesn't compete with the search input for room.
         * The previous 280px popover was the same width as the
         * trigger, which clipped the search field. */
        className="w-[340px] p-0 z-[280] border border-[#E8ECF1] rounded-xl shadow-[0_24px_56px_-12px_rgba(15,23,42,0.22)] overflow-hidden bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 outline-hidden flex flex-col"
      >
        <Command className="flex flex-col min-h-0">
          {/* Header stack mirrors the canonical Add Freight modal's
              carrier picker exactly — same neutral search input, then
              the Create CTA pinned outside the scroll area. Keeps the
              two pickers visually consistent across the app. */}
          <div className="p-2 border-b border-[#F1F5F9] shrink-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <CommandPrimitive.Input
                placeholder="Search units..."
                value={search}
                onValueChange={setSearch}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300"
              />
            </div>
          </div>
          <div className="px-1.5 pt-1.5 pb-1 shrink-0 border-b border-[#F1F5F9]">
            <a
              href="https://swift-peek-studio.lovable.app/uom"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Unit</span>
            </a>
          </div>
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="py-5 text-center text-[11px] text-slate-500">
              <p style={{ fontWeight: 500 }}>No matching unit.</p>
              <p className="text-[11px] text-slate-400 mt-1">Use "Create New Unit" above to add it.</p>
            </CommandEmpty>
            <CommandGroup
              heading={
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Defined Alternatives</span>
              }
            >
              {QV_UOM_OPTIONS.map((u) => {
                const disabled = disabledIds.has(u.id) && u.id !== value;
                return (
                  <CommandItem
                    key={u.id}
                    value={`${u.label} ${u.symbol} ${u.id}`}
                    disabled={disabled}
                    onSelect={() => {
                      if (disabled) return;
                      onChange(u.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="truncate text-[12px]">{highlight(u.label)}</span>
                      <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{highlight(u.symbol)}</span>
                    </span>
                    {u.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {Array.from(indexableByGroup.entries()).map(([group, units]) => (
              <CommandGroup
                key={group}
                heading={
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{group}</span>
                }
              >
                {units.map((u) => {
                  const disabled = disabledIds.has(u.id) && u.id !== value;
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${u.label} ${u.symbol} ${u.id}`}
                      disabled={disabled}
                      onSelect={() => {
                        if (disabled) return;
                        onChange(u.id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="truncate text-[12px]">{highlight(u.label)}</span>
                        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{highlight(u.symbol)}</span>
                      </span>
                      {u.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverPrimitive.Content>
    </Popover>
  );
}

function FieldInfo({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="More Info"
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-help align-middle"
        >
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[260px] text-[11px] leading-relaxed z-[300]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/* Hover explainer for the partner-inherited (grayed-out) sections in the
 * location-scoped Configure step. The section content is pointer-events-none,
 * so the wrapper carries the Tooltip trigger — hovering anywhere on the
 * grayed section repeats the top banner's why in place. Renders children
 * untouched when the section isn't locked. */
function InheritedSectionTooltip({ active, partnerName, children }: { active: boolean; partnerName: string; children: React.ReactElement }) {
  if (!active) return children;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-[280px] text-[11px] leading-relaxed z-[300]">
        Inherited from <span style={{ fontWeight: 600 }}>{partnerName}</span> and identical across all of its locations. To make changes, edit this item's configuration at the partner level.
      </TooltipContent>
    </Tooltip>
  );
}

function StockStatusDot({ status }: { status: string }) {
  const s = STOCK_STATUS_STYLES[status] || STOCK_STATUS_STYLES["In Stock"];
  return (
    <span className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0" style={{ fontWeight: 500, backgroundColor: s.bg, color: s.color, borderColor: s.border }}>
      {status}
    </span>
  );
}

function AcqBadge({ method }: { method: string }) {
  const s = ACQ_BADGE_STYLES[method] || ACQ_BADGE_STYLES["Purchased"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap border"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border, fontWeight: 500 }}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["Active"];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border"
      style={{ color: style.color, backgroundColor: style.bg, borderColor: style.border, fontWeight: 600 }}
    >
      {status}
    </span>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
      {label}
    </span>
  );
}

/**
 * PersonCell — used by Created By + Owner columns. Same interaction
 * grammar as Partners listing's created_by cell:
 *   - photo avatar (falls back to initials on a colored circle)
 *   - hover anywhere on the cell shows a contact business-card popover
 *     (dark gradient header + white email/phone footer)
 *   - clicking the avatar OR the name navigates to the contact's
 *     detail page in a new tab; click is stopped from propagating
 *     so the row-level item navigation doesn't also fire.
 */
function PersonCell({ person, isComfort }: { person: ItemTeamMember; isComfort: boolean }) {
  const [imgErr, setImgErr] = React.useState(false);
  const showImg = !!person.photoUrl && !imgErr;
  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/partners/contacts/${person.contactId}`, "_blank", "noopener,noreferrer");
  };
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div
          className={`flex items-center cursor-pointer group/person ${isComfort ? "gap-2.5" : "gap-2"}`}
          onClick={handleNavigate}
        >
          <div
            className={`${isComfort ? "w-8 h-8 text-[10px]" : "w-7 h-7 text-[9px]"} rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden`}
            style={{ backgroundColor: showImg ? "transparent" : person.bgColor, fontWeight: 600 }}
          >
            {showImg ? (
              <img
                src={person.photoUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgErr(true)}
              />
            ) : (
              person.initials
            )}
          </div>
          <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 truncate group-hover/person:text-primary group-hover/person:underline transition-colors`}>
            {person.name}
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
              style={{ backgroundColor: showImg ? "transparent" : person.bgColor }}
            >
              {showImg ? (
                <img src={person.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>
                  {person.initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{person.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{person.role}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-4 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{person.email}</span></div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{person.phone}</span></div>
          <button
            type="button"
            onClick={handleNavigate}
            className="mt-2 inline-flex items-center justify-center w-full gap-1.5 h-8 rounded-md bg-primary text-white text-[12px] hover:bg-[#086AE6] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Go to Contact
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ──────────────────────────────────────────────
// Column configuration
// ──────────────────────────────────────────────

const ITEM_COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "item", label: "Item Code", minWidth: "200px", sortable: true },
  { key: "description", label: "Description", minWidth: "260px", sortable: true },
  { key: "control_type", label: "Inventory Control", minWidth: "150px", sortable: true },
  { key: "category", label: "Primary Category", minWidth: "150px", sortable: true },
  { key: "on_hand", label: "On-Hand Qty", minWidth: "120px", sortable: true, align: "right" },
  // Renamed from "Stocking Unit" — Items module uses "Base Unit" with "Alternative Units"
  // and that's the canonical pattern; consistency is non-negotiable across surfaces.
  { key: "stocking_unit", label: "Base Unit", minWidth: "110px", sortable: true },
  // Status sits right after Base Unit per stakeholder spec — it anchors the inventory
  // cluster (qty + unit + status) before the commerce / metadata cluster (preferred
  // acquisition, created_on, etc.).
  { key: "status", label: "Status", minWidth: "100px", sortable: true },
  // The redundant "Acquisition" column is dropped — only Preferred Acquisition is kept
  // since the two columns served the same purpose.
  { key: "preferred_acquisition", label: "Preferred Acquisition", minWidth: "180px" },
  { key: "last_updated_by", label: "Last Updated By", minWidth: "200px", sortable: true },
  { key: "last_updated_on", label: "Last Updated On", minWidth: "140px", sortable: true },
  { key: "created_on", label: "Created On", minWidth: "140px", sortable: true },
  { key: "created_by", label: "Created By", minWidth: "200px", sortable: true },
  { key: "owner", label: "Owner", minWidth: "200px", sortable: true },
  // ── Hidden by default but available in the column selector ──
  { key: "stock_status", label: "Stock Status", minWidth: "120px", sortable: true },
  { key: "item_type", label: "Item Type", minWidth: "160px", sortable: true },
  { key: "additional_category", label: "Additional Categories", minWidth: "170px" },
  { key: "alt_units", label: "Alt. Units", minWidth: "110px" },
  { key: "inbound_location", label: "Inbound Loc.", minWidth: "160px" },
  { key: "outbound_location", label: "Outbound Loc.", minWidth: "160px" },
];

const DEFAULT_COLUMN_ORDER = ITEM_COLUMN_DEFS.map((c) => c.key);
// Stakeholder feedback: condensed view was too noisy. Mirror the
// Partners listing's lean default — keep ~7 informational columns
// visible; the rest stay available in the column selector but ship
// hidden. Description in particular becomes a subtitle on the
// "item" cell in comfort mode (matching Partners' name + email
// subtitle pattern), so it's redundant as a separate column.
// Stakeholder spec: the partner-detail Items tab should ship with
// the same default visible columns as the standalone Items Library.
// Visible by default: item (sticky), description, control_type,
// category, on_hand, stocking_unit, acquisition, preferred_acquisition,
// created_on, created_by, owner, status. Everything else stays in
// the column selector hidden by default.
const DEFAULT_HIDDEN_COLUMNS = new Set<string>([
  "stock_status",
  "item_type",
  "additional_category",
  "alt_units",
  "inbound_location",
  "outbound_location",
]);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  ITEM_COLUMN_DEFS.map((c) => [c.key, !DEFAULT_HIDDEN_COLUMNS.has(c.key)])
);
const LOCKED_COLUMNS = ["item"];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  ITEM_COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const MIN_COL_WIDTH = 1;

// ──────────────────────────────────────────────
// Transactions sub-tab column configuration
// The Transactions table is a separate ledger surface (PurchaseHistoryView)
// with its own column set — keeping a parallel def list here so the column
// selector drawer matches the actual rendered columns when the user is
// on the Transactions sub-tab.
// ──────────────────────────────────────────────
// Per-transaction ledger: one row per receipt (purchasing) or shipment
// (selling). A partial receipt against one PO produces its own row, so the
// same item can appear multiple times. Labels default to the purchasing
// direction; the Sales sub-tab relabels date/qty/order inline.
const TRANSACTION_COLUMN_DEFS: ColumnConfig[] = [
  { key: "item", label: "Item" },
  { key: "date", label: "Date Received" },
  { key: "qty", label: "Quantity Received" },
  { key: "po_unit", label: "Receiving Unit of Measure" },
  { key: "base_uom", label: "Base Unit of Measure" },
  { key: "unit_price", label: "Unit Price" },
  { key: "value", label: "Value" },
  { key: "order", label: "PO" },
];
/* Pack size per purchasing unit — how many base units (Each) one
 * PO/SO unit carries. Demo-stable until the real item UoM feed lands. */
const UOM_PACK_SIZE: Record<string, number> = { Each: 1, Box: 12, Case: 24, Pallet: 144 };
/* Receiving/shipping UoM per item — deterministic so the same item always
 * shows the same unit. Weighted toward "Each" so roughly half the ledger
 * matches the base UoM and the rest arrives in pack units. Demo-stable
 * until the real item UoM feed lands. */
const RECEIVING_UOM_POOL = ["Each", "Each", "Each", "Box", "Case", "Pallet"];
const receivingUomForItem = (itemId: string) =>
  RECEIVING_UOM_POOL[hashStringForRestriction(`recv-uom:${itemId}`) % RECEIVING_UOM_POOL.length];
const DEFAULT_TRANSACTION_COLUMN_ORDER = TRANSACTION_COLUMN_DEFS.map((c) => c.key);
const DEFAULT_TRANSACTION_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  TRANSACTION_COLUMN_DEFS.map((c) => [c.key, true])
);
const TRANSACTION_LOCKED_COLUMNS = ["item"];
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 60;

// ──────────────────────────────────────────────
// Add Item Modal
// ──────────────────────────────────────────────

type ModalView = "browse" | "added" | "configure";

export function AddItemModal({
  open,
  onOpenChange,
  existingItemIds,
  existingItems,
  onItemsAdded,
  onItemRemoved,
  onItemEdited,
  activeSubTab,
  generic,
  contextLabel,
  contextType,
  partnerId,
  locationName,
  partnerQualifiedIds,
  editMode,
  editItem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingItemIds: Set<string>;
  existingItems: PartnerItemData[];
  onItemsAdded: (items: PartnerItemData[]) => void;
  onItemRemoved: (id: string) => void;
  /** Edit-mode save handler — replaces the matching item in the
   *  partner's items list with the updated QV config. Distinct from
   *  onItemsAdded so the parent doesn't double-add the same row. */
  onItemEdited?: (item: PartnerItemData) => void;
  activeSubTab: "sell" | "purchase";
  generic?: boolean;
  contextLabel?: string;
  contextType?: "discount" | "premium";
  /** The partner whose Items tab opened the modal. Needed by the
   *  Approved-Buyer "other approved buyers" chip + the per-row
   *  approved-allowlist lookup. */
  partnerId: string;
  /** Set when the modal is opened from a LOCATION detail (location
   *  scope). Vendor priority and price per unit are partner-level
   *  values — a location can never diverge from its parent partner —
   *  so location scope switches the Configure step between two states:
   *  item already qualified with the partner → priority + price locked
   *  (read-only, sourced from the partner); first-time qualification →
   *  editable, with copy that the values apply partner-wide. */
  locationName?: string;
  /** Ids of items already qualified at the PARTNER level. Drives the
   *  locked-vs-first-time split above. Only set in location scope. */
  partnerQualifiedIds?: Set<string>;
  /** Edit-Configuration mode — opens the modal scoped to a single
   *  existing qualified-vendor item, jumping straight to Configure
   *  Pricing with the left rail + stepper hidden. */
  editMode?: boolean;
  /** The existing item whose QV config is being edited. Required when
   *  editMode is true. */
  editItem?: PartnerItemData | null;
}) {
  const { openLightbox } = usePersonLightbox();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addedSelectedIds, setAddedSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ModalView>("browse");
  const [addedSearch, setAddedSearch] = useState("");
  const [addedPage, setAddedPage] = useState(1);
  /* Approved-Buyer mode (purchase sub-tab) — default to filtering the
   * candidate catalog down to restricted items only. Unrestricted items
   * are open to every partner so adding them here is a no-op; the user
   * should know that before they go hunting for a part number. */
  const isApprovedBuyerMode = activeSubTab === "purchase";
  const [restrictedOnly, setRestrictedOnly] = useState(true);
  /* All vendors (for the "other approved buyers" chip in each row +
   * the bulk-grant-by-scheme buttons). Sourced from context so the
   * roster matches the rest of the module. */
  const { vendors: _allVendorsForApprovedBuyers, getVendor: _getVendorForQv } = useVendors();
  /* All-vendor roster reused for the Other Qualified Vendors section
   * in the Configure step. Same source as the Approved-Buyer chip so
   * the names stay canonical across both relationship directions. */
  const _allVendorsForOtherQvs = _allVendorsForApprovedBuyers;
  /* Resolved current partner — used to label the user's own draft row
   * inside the QV roster ("Toyota International · This partner"). */
  const _currentPartner = _getVendorForQv(partnerId);
  const _currentPartnerName = _currentPartner?.displayName || _currentPartner?.companyName || "This partner";
  // Per-item config captured in the Configure step (Sell sub-tab only).
  // Keyed by item id so jumping back to Browse and refining the selection
  // doesn't lose values the user already typed.
  const [configById, setConfigById] = useState<Record<string, QualifiedVendorConfig>>({});
  // Apply-to-all helper draft — lives at the Configure-step header and
  // can be stamped onto every selected card with one click.
  const [bulkConfigDraft, setBulkConfigDraft] = useState<QualifiedVendorConfig>(() => ({
    priority: "auto",
    pricePerUnit: "",
    uom: "Each",
    minOrderQty: "",
    maxOrderQty: "",
    multiples: "",
    acceptedDeviationPct: "",
    leadTimeDays: "",
    appliedPricingRuleIds: [],
  }));
  // Configure step layout state — split-pane wizard (left rail list,
  // right panel form). Only one item is focused at a time so the form
  // reads like the canonical Inventory Movement / item-detail flow.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  /* Configure-step left-rail search — at 50+ selected items the
   * "Items to configure" list becomes unscannable; this filters the
   * rail in place by partNo / description / category. Doesn't affect
   * the underlying selection, only what's visible in the rail. */
  const [configureRailSearch, setConfigureRailSearch] = useState("");
  // Which sections of the right-panel form are open. Item Configuration
  // opens by default; the others stay collapsed.
  type ConfigSection = "config" | "freight" | "pricing";
  const [openSections, setOpenSections] = useState<Set<ConfigSection>>(() => new Set(["config"]));
  const toggleSection = (s: ConfigSection) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });
  const perPage = 15;
  // Item quick-view state — same shared QuickViewPanel the main
  // partner-detail Items tab uses, so the image-click experience is
  // identical across surfaces. Lives at the modal scope so opening
  // an item preview never tears down the parent modal's selection.
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  // Exit-warning state — when the user has unsaved work (any items
  // selected, any per-item config drafted, or they've stepped past
  // Browse) attempting to close prompts a discard confirmation rather
  // than blowing the selection away on the next reopen.
  const [exitWarnOpen, setExitWarnOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setAddedSelectedIds(new Set());
      setPage(1);
      setAddedSearch("");
      setAddedPage(1);
      setBulkConfigDraft({
        priority: "auto",
        pricePerUnit: "",
        uom: "Each",
        minOrderQty: "",
        maxOrderQty: "",
        multiples: "",
        acceptedDeviationPct: "",
        leadTimeDays: "",
        appliedPricingRuleIds: [],
      });
      setOpenSections(new Set(["config"]));
      setAdvancedOrderingIds(new Set());
      setBulkPopoverOpen(false);
      setInheritedFreightByItem({});
      setInheritedPricingByItem({});
      // Edit-Configuration entry — jump straight to Configure with the
      // single edited item pre-selected and its existing config seeded.
      if (editMode && editItem) {
        setSelectedIds(new Set([editItem.id]));
        setFocusedItemId(editItem.id);
        setView("configure");
        const existing = editItem.qualifiedVendorConfig;
        setConfigById({
          [editItem.id]: existing
            ? { ...existing }
            : {
                priority: "auto",
                pricePerUnit: "",
                uom: ON_HAND_UNIT_TO_UOM[editItem.onHandUnit] || "Each",
                minOrderQty: "",
                maxOrderQty: "",
                multiples: "",
                acceptedDeviationPct: "",
                leadTimeDays: "",
                appliedPricingRuleIds: [],
              },
        });
      } else {
        setSelectedIds(new Set());
        setConfigById({});
        setView("browse");
        setFocusedItemId(null);
      }
    }
  }, [open, editMode, editItem]);

  const available = useMemo(() => {
    return INVENTORY_ITEMS.filter((it) => !existingItemIds.has(it.id));
  }, [existingItemIds]);

  const filtered = useMemo(() => {
    let list = available;
    // Restricted-only gate — Approved Buyer mode only. ON by default.
    if (isApprovedBuyerMode && restrictedOnly) {
      list = list.filter((it) => it.isRestricted);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.manufacturer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [available, search, isApprovedBuyerMode, restrictedOnly]);

  // Already added items — filtered for current sub-tab direction
  const addedFiltered = useMemo(() => {
    let list = existingItems;
    if (addedSearch.trim()) {
      const q = addedSearch.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.manufacturer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [existingItems, addedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const addedTotalPages = Math.max(1, Math.ceil(addedFiltered.length / perPage));
  const addedPaginated = addedFiltered.slice((addedPage - 1) * perPage, addedPage * perPage);

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAddedItem(id: string) {
    setAddedSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Browse-step CTA. On the Sell sub-tab (qualified-vendor flow) the
  // user steps into the Configure view to capture pricing + ordering
  // params per item before commit. The Purchase sub-tab (approved-buyer
  // flow) has no pricing concept — it commits directly, preserving the
  // existing one-click behaviour.
  function handleAdd() {
    const items = INVENTORY_ITEMS.filter((it) => selectedIds.has(it.id));
    if (activeSubTab === "sell") {
      setConfigById((prev) => {
        const next: Record<string, QualifiedVendorConfig> = { ...prev };
        items.forEach((it) => {
          if (!next[it.id]) {
            /* Location scope, item already qualified with the partner:
             * seed priority + price from the partner-level record (a
             * deterministic stand-in for the real QV index) — those two
             * fields render locked in the Configure step because a
             * location can never diverge from its parent partner. */
            const lockedFromPartner = !!locationName && !!partnerQualifiedIds?.has(it.id);
            const partnerSeed = hashStringForRestriction(`partner-qv:${partnerId}:${it.id}`) || 1;
            const partnerPrice = (seededRng(partnerSeed)() * 180 + 5).toFixed(2);
            const partnerPriority = String((partnerSeed % 3) + 1);
            next[it.id] = {
              priority: lockedFromPartner ? partnerPriority : "auto",
              pricePerUnit: lockedFromPartner ? partnerPrice : "",
              uom: ON_HAND_UNIT_TO_UOM[it.onHandUnit] || "Each",
              minOrderQty: "",
              maxOrderQty: "",
              multiples: "",
              acceptedDeviationPct: "",
              leadTimeDays: "",
              locationId: "",
              // Seed Freight + Pricing Rules from the partner's defaults
              // so the user sees concrete cards instead of empty states.
              // The two seeds are stamped as "inherited" via the
              // separate inheritance sets below, mirroring the pattern
              // used in the partner-location modal's Freight tab.
              shippingMethodIds: INHERITED_PARTNER_FREIGHT_METHOD_IDS,
              defaultShippingMethodId: INHERITED_PARTNER_FREIGHT_METHOD_IDS[0] || "",
              appliedPricingRuleIds: INHERITED_PARTNER_PRICING_RULE_IDS,
            };
          }
        });
        return next;
      });
      // Track which ids were originally inherited so the cards can
      // surface an "Inherited" pill — separate from the user-added ones.
      setInheritedFreightByItem((prev) => {
        const next = { ...prev };
        items.forEach((it) => {
          if (!next[it.id]) next[it.id] = new Set(INHERITED_PARTNER_FREIGHT_METHOD_IDS);
        });
        return next;
      });
      setInheritedPricingByItem((prev) => {
        const next = { ...prev };
        items.forEach((it) => {
          if (!next[it.id]) next[it.id] = new Set(INHERITED_PARTNER_PRICING_RULE_IDS);
        });
        return next;
      });
      // Focus the first selected item by default — the rest sit in the
      // left rail and the user clicks into each. Mirrors the canonical
      // Inventory Movement / item-detail configure flow.
      setFocusedItemId(items[0]?.id || null);
      setOpenSections(new Set(["config"]));
      setView("configure");
      return;
    }
    onItemsAdded(items);
    onOpenChange(false);
    toast.success(generic
      ? `${items.length} item${items.length !== 1 ? "s" : ""} added`
      : `${items.length} item${items.length !== 1 ? "s" : ""} added to items they buy`);
  }

  // Resolves the draft primaryTierIndex pointer at save time: the
  // chosen tier's values swap into the base pricePerUnit/uom fields
  // (which downstream consumers treat as primary) and the old base
  // values drop into that tier's slot. Deferred to save so cards
  // don't jump around while the user is still editing.
  function normalizePrimaryTier(cfg?: QualifiedVendorConfig): QualifiedVendorConfig | undefined {
    if (!cfg) return cfg;
    const idx = cfg.primaryTierIndex;
    if (idx == null || idx < 0 || !cfg.additionalPrices || idx >= cfg.additionalPrices.length) {
      return { ...cfg, primaryTierIndex: undefined };
    }
    const tiers = cfg.additionalPrices.slice();
    const promoted = tiers[idx];
    tiers[idx] = {
      price: cfg.pricePerUnit,
      uom: cfg.uom,
      minOrderQty: cfg.minOrderQty,
      maxOrderQty: cfg.maxOrderQty,
      multiples: cfg.multiples,
      acceptedDeviationPct: cfg.acceptedDeviationPct,
      leadTimeDays: cfg.leadTimeDays,
    };
    return {
      ...cfg,
      pricePerUnit: promoted.price,
      uom: promoted.uom,
      minOrderQty: promoted.minOrderQty ?? "",
      maxOrderQty: promoted.maxOrderQty ?? "",
      multiples: promoted.multiples ?? "",
      acceptedDeviationPct: promoted.acceptedDeviationPct ?? "",
      leadTimeDays: promoted.leadTimeDays ?? "",
      additionalPrices: tiers,
      primaryTierIndex: undefined,
    };
  }

  // Configure-step Save. Stamps each selected item with its captured
  // qualifiedVendorConfig before calling onItemsAdded so the partner
  // state carries pricing + ordering params round-trip.
  function handleSaveConfigured() {
    // Edit-Configuration mode — single existing item, save through the
    // edit callback so the parent replaces the row in place instead of
    // appending a duplicate.
    if (editMode && editItem) {
      const updated: PartnerItemData = {
        ...editItem,
        qualifiedVendorConfig: normalizePrimaryTier(configById[editItem.id]),
      };
      onItemEdited?.(updated);
      onOpenChange(false);
      toast.success("Configuration updated");
      return;
    }
    const items = INVENTORY_ITEMS.filter((it) => selectedIds.has(it.id)).map((it) => ({
      ...it,
      qualifiedVendorConfig: normalizePrimaryTier(configById[it.id]),
    }));
    onItemsAdded(items);
    onOpenChange(false);
    toast.success(generic
      ? `${items.length} item${items.length !== 1 ? "s" : ""} added`
      : `${items.length} item${items.length !== 1 ? "s" : ""} added as qualified vendor`);
  }

  function updateItemConfig(id: string, patch: Partial<QualifiedVendorConfig>) {
    setConfigById((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  /* ── Pricing-rule action handlers (shared-rule edit / remove / create) ── */

  /** "Create a copy for this partner" — runs the canonical duplicate
   *  flow: opens the Create Pricing Rule modal prefilled from the
   *  source rule with " (Copy)" in the title. The partner-scoped copy
   *  is minted (and swapped in) when the user saves the form. */
  function handleCreateRuleCopy() {
    if (!pendingRuleEdit) return;
    setRuleFormSession({ mode: "copy", rule: pendingRuleEdit.rule });
    setPendingRuleEdit(null);
  }

  /** "Edit for all partners" — opens the same pricing-rule modal
   *  prefilled as-is; saving lands the change on every partner using
   *  the current version. */
  function handleEditRuleForAll() {
    if (!pendingRuleEdit) return;
    setRuleFormSession({ mode: "edit", rule: pendingRuleEdit.rule });
    setPendingRuleEdit(null);
  }

  /** Save handler for the embedded pricing-rule form. Copy mode mints
   *  the partner-scoped rule from what the user actually saved and
   *  swaps it in on every configured item (the copy replaces the
   *  previous one for this partner; other partners keep the original).
   *  Edit mode overrides the shared rule everywhere. */
  function handleRuleFormSaved(saved: { name: string; description: string; category: "discount" | "premium" }) {
    if (!ruleFormSession) return;
    const src = ruleFormSession.rule;
    if (ruleFormSession.mode === "copy") {
      const copy: QvPricingRule = {
        id: `${src.id}--copy-${partnerId}`,
        label: saved.name,
        subtitle: saved.description || src.subtitle,
        type: saved.category,
        custom: true,
      };
      setCustomPartnerRules((prev) => (prev.some((r) => r.id === copy.id) ? prev.map((r) => (r.id === copy.id ? copy : r)) : [...prev, copy]));
      setConfigById((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const ids = next[id]?.appliedPricingRuleIds || [];
          if (ids.includes(src.id)) next[id] = { ...next[id], appliedPricingRuleIds: ids.map((rid) => (rid === src.id ? copy.id : rid)) };
        });
        return next;
      });
      toast.success(`"${saved.name}" saved and applied to ${_currentPartnerName}, other partners keep the original.`);
    } else {
      setSharedRuleOverrides((prev) => ({
        ...prev,
        [src.id]: { label: saved.name, subtitle: saved.description || src.subtitle, type: saved.category },
      }));
      toast.success(`"${saved.name}" updated for all partners using this rule.`);
    }
  }

  /** Confirmed remove — detaches the rule from this partner altogether:
   *  it comes off every configured item, not just the card it was
   *  clicked on. The rule itself is not deleted. */
  function handleRemoveRuleFromPartner() {
    if (!pendingRuleRemove) return;
    const { rule } = pendingRuleRemove;
    setConfigById((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        const ids = next[id]?.appliedPricingRuleIds || [];
        if (ids.includes(rule.id)) next[id] = { ...next[id], appliedPricingRuleIds: ids.filter((rid) => rid !== rule.id) };
      });
      return next;
    });
    toast.success(`"${rule.label}" removed from ${_currentPartnerName}, it no longer applies to any item.`);
    setPendingRuleRemove(null);
  }

  /** Create New — simple partner-scoped rule, applied immediately to
   *  the item the flow was launched from. */
  function handleCreateNewRule() {
    if (!createRuleForItem || !newRuleName.trim() || !newRuleValue.trim()) return;
    const id = `custom-${partnerId}-${customPartnerRules.length + 1}-${newRuleName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const rule: QvPricingRule = {
      id,
      label: newRuleName.trim(),
      subtitle: `${newRuleValue}% ${newRuleType === "discount" ? "off" : "markup"} · Created for ${_currentPartnerName}`,
      type: newRuleType,
      custom: true,
    };
    setCustomPartnerRules((prev) => [...prev, rule]);
    setConfigById((prev) => {
      const cfg = prev[createRuleForItem.id];
      const ids = cfg?.appliedPricingRuleIds || [];
      return { ...prev, [createRuleForItem.id]: { ...cfg, appliedPricingRuleIds: [...ids, id] } };
    });
    toast.success(`"${rule.label}" created and applied to ${createRuleForItem.partNo}`);
    setCreateRuleForItem(null);
  }

  // Apply-to-all lives in a Popover anchored to the toolbar so it
  // doesn't dominate the page. Users opt-in when they want bulk fill.
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState(false);
  /* Add-Carrier / Add-Rule picker popovers — track which item the
   * picker is currently open for. Only one of each may be open at a
   * time across the configure surface; the trigger button in each
   * section drives the matching state. */
  const [addCarrierOpenForItem, setAddCarrierOpenForItem] = useState<string | null>(null);
  const [addRuleOpenForItem, setAddRuleOpenForItem] = useState<string | null>(null);
  /* Pricing-rule action prompts (stakeholder feedback on the
   * qualification flow):
   *  · Edit on a shared rule first warns that the change lands on
   *    every partner using the current version, lists those partners,
   *    and offers a partner-scoped copy as the safe alternative.
   *  · Remove always confirms — the rule comes off this partner
   *    altogether (all items), not just the card it was clicked on.
   *  · Create New spins up a simple partner-scoped rule with the
   *    launching item preselected. */
  const [pendingRuleEdit, setPendingRuleEdit] = useState<{ itemId: string; rule: QvPricingRule } | null>(null);
  const [pendingRuleRemove, setPendingRuleRemove] = useState<{ itemId: string; rule: QvPricingRule } | null>(null);
  const [createRuleForItem, setCreateRuleForItem] = useState<PartnerItemData | null>(null);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<"discount" | "premium">("discount");
  const [newRuleValue, setNewRuleValue] = useState("");
  /* Partner-scoped rules minted in this session — copies made from the
   * shared-rule edit warning plus rules from the Create New flow. They
   * join the presets everywhere rules are listed in this modal. */
  const [customPartnerRules, setCustomPartnerRules] = useState<QvPricingRule[]>([]);
  /* "Edit for all partners" outcomes — label/subtitle/type overrides
   * applied on top of the shared presets (the preset list itself is a
   * module constant). Production writes through to the rules store. */
  const [sharedRuleOverrides, setSharedRuleOverrides] = useState<Record<string, Partial<QvPricingRule>>>({});
  /* Canonical pricing-rule form session — opened by the shared-rule
   * warning's "Create a copy" (duplicate flow, name prefixed with
   * " (Copy)") and "Edit for all partners" (same modal, prefilled
   * as-is) options. Mounting the embedded PricingRulesTabNew runs the
   * exact modal from the Pricing Rules tab. */
  const [ruleFormSession, setRuleFormSession] = useState<{ mode: "copy" | "edit"; rule: QvPricingRule } | null>(null);
  const allPricingRules = useMemo(
    () => [
      ...QV_PRICING_RULE_PRESETS.map((r) => (sharedRuleOverrides[r.id] ? { ...r, ...sharedRuleOverrides[r.id] } : r)),
      ...customPartnerRules,
    ],
    [customPartnerRules, sharedRuleOverrides]
  );
  /* Deterministic affected-partners roster for the shared-rule edit
   * warning. In production this comes from the rule's usage index; the
   * prototype derives a stable 3–6 partner subset from the rule id so
   * the same rule always lists the same partners. */
  const affectedPartnersForRule = useMemo(() => {
    if (!pendingRuleEdit) return [];
    const others = _allVendorsForApprovedBuyers.filter((v) => v.id !== partnerId && v.status === "active");
    if (others.length === 0) return [];
    const seed = pendingRuleEdit.rule.id.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const count = Math.min(3 + (seed % 4), others.length);
    const start = seed % others.length;
    return Array.from({ length: count }, (_, i) => others[(start + i) % others.length]);
  }, [pendingRuleEdit, _allVendorsForApprovedBuyers, partnerId]);
  // Per-item toggle for "Configure advanced ordering rules" — when
  // enabled, the form reveals Order Quantity + Tolerance & Timing.
  // Default off so the form stays focused on Priority + Pricing.
  const [advancedOrderingIds, setAdvancedOrderingIds] = useState<Set<string>>(new Set());
  /* Per-card "Additional configuration" collapse state for the Vendor
   * Pricing section on the right. Keyed by `${it.id}:p` for the
   * primary tier and `${it.id}:${ti}` for additional tiers. Cards in
   * this set have the Min/Max/Multiples/Tolerance/Lead Time block
   * expanded; everything else stays collapsed by default for a
   * cleaner visual. */
  const [pricingConfigOpen, setPricingConfigOpen] = useState<Set<string>>(new Set());
  const togglePricingConfig = (key: string) => setPricingConfigOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  /* Per-item flat roster order. Keyed by item id, holds the ranked
   * list of card ids (vendor id for existing QVs, the sentinel
   * "__draft__" for the new partner's row). With tie-allowing tiers
   * this only sequences cards WITHIN a shared priority level — the
   * level itself lives in qvTiersById. */
  const [qvOrderById, setQvOrderById] = useState<Record<string, string[]>>({});
  /* Per-item raw priority ranks, keyed by card id. Ties are allowed —
   * several vendors can hold the same rank (one priority level).
   * computeRoster() densifies raw ranks into gap-free tiers
   * (1..MAX_PRIORITY) for display + save, mirroring the Items module's
   * Add Qualified Vendors roster. Absent entry = seeded layout
   * (existing QVs at their saved rank, draft below them). */
  const [qvTiersById, setQvTiersById] = useState<Record<string, Record<string, number>>>({});
  /* Per-item primary vendor (the starred auto-PO anchor) — card id or
   * null. At most one per item and only a Priority 1 vendor qualifies;
   * moving the starred vendor off the top level clears the flag. */
  const [qvPrimaryById, setQvPrimaryById] = useState<Record<string, string | null>>({});
  // Inherited-id sets per item — let the Freight + Pricing Rules
  // cards render an "Inherited" pill on the rows that came from the
  // partner's defaults, separating them from user-added overrides.
  const [inheritedFreightByItem, setInheritedFreightByItem] = useState<Record<string, Set<string>>>({});
  const [inheritedPricingByItem, setInheritedPricingByItem] = useState<Record<string, Set<string>>>({});
  const toggleAdvancedOrdering = (id: string) => setAdvancedOrderingIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Apply the bulk draft to every selected item, but only overwrite a
  // field where the draft has a value — so users can stamp shared
  // values (e.g. UOM + Lead Time) without nuking per-item prices.
  function applyBulkToAll() {
    setConfigById((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        const current = next[id] || {
          priority: "auto", pricePerUnit: "", uom: "Each", minOrderQty: "", maxOrderQty: "",
          multiples: "", acceptedDeviationPct: "", leadTimeDays: "", appliedPricingRuleIds: [],
        };
        /* Location scope: items already qualified with the partner keep
         * their partner-level priority + price — bulk apply never
         * overwrites values a location can't own. */
        const locked = !!locationName && !!partnerQualifiedIds?.has(id);
        next[id] = {
          priority: !locked && bulkConfigDraft.priority && bulkConfigDraft.priority !== "auto" ? bulkConfigDraft.priority : current.priority,
          pricePerUnit: locked ? current.pricePerUnit : (bulkConfigDraft.pricePerUnit || current.pricePerUnit),
          uom: locked ? current.uom : (bulkConfigDraft.uom || current.uom),
          /* additionalPrices is per-item (different UoMs unique to that
           * partner+item combo), so bulk apply never stamps it — we
           * preserve whatever the user already captured. */
          additionalPrices: current.additionalPrices,
          minOrderQty: bulkConfigDraft.minOrderQty || current.minOrderQty,
          maxOrderQty: bulkConfigDraft.maxOrderQty || current.maxOrderQty,
          multiples: bulkConfigDraft.multiples || current.multiples,
          acceptedDeviationPct: bulkConfigDraft.acceptedDeviationPct || current.acceptedDeviationPct,
          leadTimeDays: bulkConfigDraft.leadTimeDays || current.leadTimeDays,
          appliedPricingRuleIds: current.appliedPricingRuleIds,
        };
      });
      return next;
    });
    toast.success(`Applied to ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}`);
  }

  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);
  // Per-row remove confirmation — clicking the trash button on a row
  // stashes its id here; the same destructive AlertDialog the bulk
  // flow uses opens with this single id when present.
  const [pendingSingleRemoveId, setPendingSingleRemoveId] = useState<string | null>(null);

  function handleBulkRemove() {
    const count = addedSelectedIds.size;
    addedSelectedIds.forEach((id) => onItemRemoved(id));
    toast.success(generic
      ? `${count} item${count !== 1 ? "s" : ""} removed`
      : `${count} item${count !== 1 ? "s" : ""} removed from ${activeSubTab === "sell" ? "items they sell" : "items they buy"}`);
    setAddedSelectedIds(new Set());
    setBulkRemoveConfirmOpen(false);
  }

  function handleSingleRemoveConfirm() {
    if (!pendingSingleRemoveId) return;
    const removedItem = existingItems.find((it) => it.id === pendingSingleRemoveId);
    onItemRemoved(pendingSingleRemoveId);
    toast.success(generic
      ? `${removedItem?.partNo ?? "Item"} removed`
      : `${removedItem?.partNo ?? "Item"} removed from ${activeSubTab === "sell" ? "items they sell" : "items they buy"}`);
    // Drop the row from the bulk-selection set too so the toolbar
    // count stays accurate if it was checked.
    setAddedSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(pendingSingleRemoveId);
      return next;
    });
    setPendingSingleRemoveId(null);
  }

  const tradeLabel = generic ? "Items" : (activeSubTab === "sell" ? "Items They Sell" : "Items They Buy");
  const tradeShort = generic ? "" : (activeSubTab === "sell" ? "They Sell" : "They Buy");
  // Icons swapped per stakeholder: Qualified Vendor (sell) =
  // ShoppingCart (we shop from them); Approved Buyer (purchase)
  // = Tag (we tag items as theirs to buy).
  const tradeIcon = activeSubTab === "sell" ? ShoppingCart : Tag;
  const TradeIcon = tradeIcon;
  // Relationship label — what role the partner plays for the items
  // being managed. Matches the canonical CTA wording on the main
  // Items tab ("Add as qualified vendor" / "Add to approved buyer
  // list"). Used on the modal header pill + the bottom CTA button.
  const relationshipPill = generic ? "" : (activeSubTab === "sell" ? "Qualified Vendor" : "Approved Buyer");
  // Parallel CTA suffixes — both sides read "Add N Items as <Role>"
  // for symmetry with the main Items tab CTA pair.
  const addCtaSuffix = generic ? "" : (activeSubTab === "sell" ? "as Qualified Vendor" : "as Approved Buyer");
  const browseDescription = generic
    ? "Browse inventory to add items, or manage already added items."
    : activeSubTab === "sell"
      ? "Browse inventory to add this partner as a qualified vendor on items, or manage already added items."
      : "Browse inventory to add this partner as an approved buyer on items, or manage already added items.";

  // Modal sort state
  const [modalSort, setModalSort] = useState<string>("all");

  // Counts for sort pills — aligned to the canonical Partner Items
  // tab filter set (All Items / Active / Inactive / Serialized /
  // Non-Serialized / Lot Controlled) so the Add Qualified-Vendor
  // browse step reads with the same vocabulary as the surface it
  // launched from. Replaces the older In Stock / Low Stock pair —
  // status + control type is what users actually filter against in
  // the QV-add flow.
  const browseSortCounts = useMemo(() => {
    const src = filtered;
    return {
      all: src.length,
      active: src.filter((it) => it.status === "Active").length,
      inactive: src.filter((it) => it.status === "Inactive").length,
      serialized: src.filter((it) => it.itemControlType === "Serialized").length,
      non_serialized: src.filter((it) => it.itemControlType === "Non-Serialized").length,
      lot_controlled: src.filter((it) => it.itemControlType === "Lot Controlled").length,
    };
  }, [filtered]);

  const addedSortCounts = useMemo(() => {
    const src = addedFiltered;
    return {
      all: src.length,
      active: src.filter((it) => it.status === "Active").length,
      inactive: src.filter((it) => it.status === "Inactive").length,
      serialized: src.filter((it) => it.itemControlType === "Serialized").length,
      non_serialized: src.filter((it) => it.itemControlType === "Non-Serialized").length,
      lot_controlled: src.filter((it) => it.itemControlType === "Lot Controlled").length,
    };
  }, [addedFiltered]);

  const MODAL_SORT_OPTIONS = view === "browse"
    ? [
        { key: "all", label: "All Items", count: browseSortCounts.all },
        { key: "active", label: "Active", count: browseSortCounts.active },
        { key: "inactive", label: "Inactive", count: browseSortCounts.inactive },
        { key: "serialized", label: "Serialized", count: browseSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: browseSortCounts.non_serialized },
        { key: "lot_controlled", label: "Lot Controlled", count: browseSortCounts.lot_controlled },
      ]
    : [
        { key: "all", label: "All Items", count: addedSortCounts.all },
        { key: "active", label: "Active", count: addedSortCounts.active },
        { key: "inactive", label: "Inactive", count: addedSortCounts.inactive },
        { key: "serialized", label: "Serialized", count: addedSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: addedSortCounts.non_serialized },
        { key: "lot_controlled", label: "Lot Controlled", count: addedSortCounts.lot_controlled },
      ];

  // Reset sort when switching views
  useEffect(() => { setModalSort("all"); }, [view]);

  // Apply sorting filter — uses the same status + control-type
  // predicates the Partner Items tab uses, so the count under each
  // pill matches what the user expects from the parent surface.
  const sortedBrowse = useMemo(() => {
    let list = filtered;
    if (modalSort === "active") list = list.filter((it) => it.status === "Active");
    else if (modalSort === "inactive") list = list.filter((it) => it.status === "Inactive");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    else if (modalSort === "lot_controlled") list = list.filter((it) => it.itemControlType === "Lot Controlled");
    return list;
  }, [filtered, modalSort]);

  const sortedAdded = useMemo(() => {
    let list = addedFiltered;
    if (modalSort === "active") list = list.filter((it) => it.status === "Active");
    else if (modalSort === "inactive") list = list.filter((it) => it.status === "Inactive");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    else if (modalSort === "lot_controlled") list = list.filter((it) => it.itemControlType === "Lot Controlled");
    return list;
  }, [addedFiltered, modalSort]);

  const browseTotalPages = Math.max(1, Math.ceil(sortedBrowse.length / perPage));
  const browsePaginated = sortedBrowse.slice((page - 1) * perPage, page * perPage);
  const addedSortedTotalPages = Math.max(1, Math.ceil(sortedAdded.length / perPage));
  const addedSortedPaginated = sortedAdded.slice((addedPage - 1) * perPage, addedPage * perPage);

  // Detail-modal sizing standard — items modal is tabbed (Browse / Added)
  // so it gets the stable frame to match PaymentTerm / PricingRule / Group
  // detail modals. Width capped at 1480px, min 640px height.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  // Edit-Configuration mode trims ~10% off the default max-width —
  // the surface is scoped to a single item (no left rail, no
  // multi-item priority lists), so the wide 1480px frame the multi-
  // add flow needs feels oversized for an edit. Stepping to ~1330px
  // / 67.5vw keeps the two-column form roomy without the panels
  // floating in whitespace.
  const editModeWidth = editMode ? "sm:!max-w-[min(67.5vw,1332px)]" : "sm:!max-w-[min(75vw,1480px)]";
  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] ${editModeWidth} !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  // Shared table row renderer for both views
  const renderItemRow = (item: PartnerItemData, mode: "browse" | "added") => {
    const isSelected = mode === "browse" ? selectedIds.has(item.id) : false;
    const isAddedSelected = mode === "added" ? addedSelectedIds.has(item.id) : false;
    // Modal table row — column set + cell styling + interaction
    // grammar all match the main partner-detail Items tab exactly:
    // 32px thumbnail with hover-preview card and click-opens-quick-
    // view; mono code with hover-underline + click-opens-URL. Click
    // handlers stopPropagation so the row-selection click (toggling
    // checkbox) doesn't also fire.
    const trail = item.id.split("-").pop();
    const numericId = trail && /^\d+$/.test(trail) ? String(parseInt(trail, 10) + 1) : "1";
    const itemUrl = `https://nimble-palette.lovable.app/items/${numericId}`;
    const rowIsSelected = isSelected || isAddedSelected;
    // Sticky cells need their own opaque base bg because they're
    // positioned over the scrolled cells; without one, scrolled
    // content bleeds through at rest (the previous group-hover-only
    // class only painted on hover). Use white at rest, the accent
    // tint when selected, and the same hover tint as the row.
    const stickyCellBg = rowIsSelected
      ? "!bg-accent/30"
      : "bg-white group-hover:bg-[#F0F7FF]";
    return (
      <TableRow
        key={item.id}
        className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2 ${rowIsSelected ? "!bg-accent/30" : ""}`}
        onClick={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
      >
        {/* Checkbox — sticky leftmost (matches main table) */}
        <TableCell className={`sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 ${stickyCellBg}`} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={mode === "browse" ? isSelected : addedSelectedIds.has(item.id)}
            onCheckedChange={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
          />
        </TableCell>
        {/* Item Code — sticky-left at 40px (after checkbox), matches
            the main tab's frozen Item column. overflow: hidden +
            textOverflow: ellipsis clip any content that exceeds the
            cell width so neighboring scrolled cells never bleed
            through. */}
        <TableCell
          className={`sticky left-[40px] z-10 ${stickyCellBg}`}
          style={{ boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)", width: 200, minWidth: 200, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <HoverCard openDelay={250} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickViewData({
                      type: "item",
                      item: { id: numericId, name: item.partNo, subtitle: item.category, imageUrl: item.image },
                      vendorName: "",
                      navUrlOverride: itemUrl,
                      navLabelOverride: "Go to Item",
                    });
                  }}
                  className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                  title="View Item Details"
                >
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                </button>
              </HoverCardTrigger>
              <ItemHoverCardContent
                image={item.image}
                partNo={item.partNo}
                category={item.category}
                manufacturer={item.manufacturer}
                description={item.description}
                inventoryControl={item.itemControlType}
                onHand={item.onHand}
                onHandUnit={item.onHandUnit}
                status={item.status}
                preferredAcquisition={item.preferredAcquisition}
              />
            </HoverCard>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(itemUrl, "_blank", "noopener,noreferrer"); }}
                className="text-sm text-slate-800 hover:text-primary hover:underline transition-colors cursor-pointer text-left block truncate w-full"
                style={{ fontWeight: 500 }}
                title="Open item detail in a new tab"
              >
                {item.partNo}
              </button>
              {/* Location scope: flag items the partner already qualifies —
                  their priority + price arrive locked in Configure, so the
                  user knows before they pick the row. */}
              {!!locationName && partnerQualifiedIds?.has(item.id) && (
                <span
                  className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9.5px] border bg-slate-50 text-slate-500 border-slate-200 whitespace-nowrap"
                  style={{ fontWeight: 600 }}
                  title={`Already qualified with ${_currentPartnerName} — priority and price per unit come from the partner.`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  Qualified at Partner
                </span>
              )}
            </div>
          </div>
        </TableCell>
        {/* Description */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 400 }}>{item.description}</p>
        </TableCell>
        {/* Restriction — Approved Buyer mode only. Single emerald
            "Restricted" pill; the row stays compact and a hover Tooltip
            surfaces the other partners already approved on this item
            (the "who else can buy this" context Eli flagged as the
            critical signal — lets the user infer the group/customer
            this item belongs to without knowing the part number). */}
        {activeSubTab === "purchase" && (
          <TableCell className="group-hover:bg-[#F0F7FF]">
            {item.isRestricted ? (() => {
              const others = getOtherApprovedBuyers(item.id, item, _allVendorsForApprovedBuyers, partnerId);
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-px rounded-md text-[10px] border whitespace-nowrap cursor-help"
                      style={{
                        fontWeight: 600,
                        backgroundColor: "#FFFBEB",
                        color: "#92400E",
                        borderColor: "#FDE68A",
                      }}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      Restricted
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-[280px] z-[300]">
                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Restricted Item</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Only partners on the approved-buyer list can order this.
                    </p>
                    {others.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-border">
                        <p className="text-[10px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>Other Approved Buyers</p>
                        <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">{others.map((o) => o.name).join(", ")}</p>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })() : (
              <span className="text-[10px] text-slate-300" style={{ fontWeight: 500 }}>Open</span>
            )}
          </TableCell>
        )}
        {/* Inventory Control */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.itemControlType}</span></TableCell>
        {/* Primary Category */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.category}</span></TableCell>
        {/* On-Hand Qty (single line, matches main tab) */}
        <TableCell className="text-right !pr-3 group-hover:bg-[#F0F7FF]">
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{item.onHand.toLocaleString()}</span>
        </TableCell>
        {/* Base Unit (renamed from Stocking Unit — matches Items module canonical pattern). */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.onHandUnit}</span></TableCell>
        {/* Status — Active / Inactive (matches main tab Status column,
            which also shows item.status, not stockStatus). */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <StatusBadge status={item.status} />
        </TableCell>
        {/* Preferred Acquisition (the redundant Acquisition column was dropped). */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><AcqBadge method={item.preferredAcquisition} /></TableCell>
        {/* Created On */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <span className="text-sm text-slate-700 whitespace-nowrap">
            {(() => { const d = new Date(item.createdOn); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); })()}
          </span>
        </TableCell>
        {/* Created By */}
        <TableCell className="group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <PersonCell person={item.createdBy} isComfort={false} />
        </TableCell>
        {/* Owner */}
        <TableCell className="group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <PersonCell person={item.owner} isComfort={false} />
        </TableCell>
        {/* Actions — remove button on right for added view */}
        {mode === "added" && (
          <TableCell className={`sticky right-0 z-10 !px-0 ${stickyCellBg}`} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-full h-full">
              <button
                onClick={() => setPendingSingleRemoveId(item.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const currentSearch = view === "browse" ? search : addedSearch;
  const setCurrentSearch = view === "browse" ? setSearch : setAddedSearch;
  const currentPage = view === "browse" ? page : addedPage;
  const setCurrentPage = view === "browse" ? setPage : setAddedPage;
  const currentTotalPages = view === "browse" ? browseTotalPages : addedSortedTotalPages;
  const currentPaginated = view === "browse" ? browsePaginated : addedSortedPaginated;
  const currentTotal = view === "browse" ? sortedBrowse.length : sortedAdded.length;

  /* Global empty / error states — Browse (catalog) vs Added (this partner). */
  const modalTableLoad = useTableLoadState();
  const modalFilterCount =
    (modalSort !== "all" ? 1 : 0) + (view === "browse" && isApprovedBuyerMode && restrictedOnly ? 1 : 0);
  const modalEmptyKind = resolveTableEmptyKind({
    loadState: modalTableLoad.loadState,
    totalCount: modalTableLoad.forceEmpty ? 0 : view === "browse" ? available.length : existingItems.length,
    filteredCount: modalTableLoad.forceEmpty ? 0 : currentTotal,
    pageCount: currentPaginated.length,
    searchQuery: currentSearch,
    filterCount: modalFilterCount,
  });
  const modalSuggestion = useMemo(() => {
    if (modalEmptyKind !== "no-results" && modalEmptyKind !== "no-results-filtered") return null;
    const pool = view === "browse" ? available : existingItems;
    return findSearchSuggestion(currentSearch, pool.flatMap((it) => [it.partNo, it.description, it.category, it.manufacturer]));
  }, [modalEmptyKind, currentSearch, view, available, existingItems]);
  const modalEmptyProps = modalEmptyKind && {
    kind: modalEmptyKind,
    entity: { singular: "item", plural: "items" },
    searchQuery: currentSearch,
    suggestion: modalSuggestion,
    onApplySuggestion: (q: string) => { setCurrentSearch(q); setCurrentPage(1); },
    filterCount: modalFilterCount,
    onClearSearch: () => { setCurrentSearch(""); setCurrentPage(1); },
    onClearFilters: () => { setModalSort("all"); if (view === "browse") setRestrictedOnly(false); setCurrentPage(1); },
    onClearAll: () => { setCurrentSearch(""); setModalSort("all"); if (view === "browse") setRestrictedOnly(false); setCurrentPage(1); },
    onRetry: modalTableLoad.retry,
    retrying: modalTableLoad.retrying,
    onFirstPage: () => setCurrentPage(1),
    compact: true,
    ...(view === "browse"
      ? { title: "No items available", description: "Every item in the catalog is already added to this partner." }
      : { title: "No items added yet", description: "Items you pick on the Browse tab will show up here." }),
  };

  // Unsaved-work check — any browse-tab selection that hasn't been
  // committed via Continue, any per-item Configure draft, or the user
  // having stepped past Browse into Configure all count. Used by the
  // close-intent intercept below. Edit-Configuration mode opens with
  // the item pre-selected + config seeded, so those signals always
  // fire — skip the warning there; the explicit Cancel/Save Changes
  // CTAs already make intent clear.
  const hasUnsavedWork = !editMode && (
    selectedIds.size > 0 ||
    Object.keys(configById).length > 0 ||
    view === "configure"
  );

  const handleCloseIntent = useCallback(() => {
    if (hasUnsavedWork) {
      setExitWarnOpen(true);
    } else {
      onOpenChange(false);
    }
  }, [hasUnsavedWork, onOpenChange]);

  // Discard everything in flight (selection + drafts + step) and let
  // the parent close the modal. Fires from the AlertDialog confirm.
  const discardAndClose = useCallback(() => {
    setSelectedIds(new Set());
    setAddedSelectedIds(new Set());
    setConfigById({});
    setView("browse");
    setExitWarnOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => {
      // Close intents (overlay click, Esc) route through the dirty
      // check; open intents pass through unchanged.
      if (nextOpen) onOpenChange(true);
      else handleCloseIntent();
    }}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border ${generic ? "z-[230]" : ""} ${modalSizeClass}`}
        hideCloseButton
        overlayClassName={generic ? "z-[225]" : undefined}
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">{editMode ? "Edit Configuration" : (generic ? "Manage Items" : (activeSubTab === "sell" ? "Manage Qualified-Vendor Items" : "Manage Approved-Buyer Items"))}</DialogTitle>
        <DialogDescription className="sr-only">{editMode ? "Edit qualified-vendor configuration for this item." : `Add or remove ${activeSubTab === "sell" ? "qualified-vendor items" : "approved-buyer items"}.`}</DialogDescription>

        {/* Header — edit-Configuration variant shows the single item it
            scopes (mirrors the Location detail modal header: avatar +
            name + chips on the left, Full view + close on the right). */}
        {editMode && editItem ? (
          <div data-page-topbar className="px-3 sm:px-5 pt-3 sm:pt-3.5 pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <img
                  src={editItem.image}
                  alt={editItem.partNo}
                  className="w-11 h-11 rounded-xl object-cover border border-[#E8ECF1] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-[15px] sm:text-[16px] text-foreground tracking-[-0.005em] mr-1" style={{ fontWeight: 700 }}>
                      {editItem.partNo}
                    </h2>
                    {/* Trade-relationship pill — names the role being
                        edited so the modal reads in the same vocabulary
                        as the Items tab. */}
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] border"
                      style={{
                        fontWeight: 600,
                        backgroundColor: "#EBF3FF",
                        color: "#0548A3",
                        borderColor: "#A8D2FF",
                      }}
                    >
                      <ShoppingCart className="w-2.5 h-2.5" />
                      Qualified Vendor
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${
                        editItem.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {editItem.status}
                    </span>
                    <span
                      className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] border bg-slate-100 text-slate-700 border-slate-200"
                      style={{ fontWeight: 600 }}
                      title={`Preferred acquisition: ${editItem.preferredAcquisition}`}
                    >
                      {editItem.preferredAcquisition}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] border bg-violet-50 text-violet-700 border-violet-200"
                      style={{ fontWeight: 600 }}
                    >
                      {editItem.category}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 mt-1 truncate">
                    {editItem.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? "Exit Full" : "Full View"}
                </button>
                <button
                  onClick={handleCloseIntent}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div data-page-topbar className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                {/* Title now uses the canonical relationship framing
                    from the main Items tab CTA (qualified vendor /
                    approved buyer) — single nomenclature across the
                    pill, title, description, and CTA. */}
                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                  {generic ? "Manage Items" : (activeSubTab === "sell" ? "Manage Qualified-Vendor Items" : "Manage Approved-Buyer Items")}
                </h2>
                {/* Trade-relationship pill — names the role the partner
                    plays for the items being managed (Qualified Vendor /
                    Approved Buyer). Aligned with the canonical CTA
                    wording on the main Items tab. */}
                {!generic && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border"
                  style={{
                    fontWeight: 600,
                    backgroundColor: activeSubTab === "sell" ? "#EBF3FF" : "#ECFDF5",
                    color: activeSubTab === "sell" ? "#0548A3" : "#065F46",
                    borderColor: activeSubTab === "sell" ? "#A8D2FF" : "#A7F3D0",
                  }}
                >
                  <TradeIcon className="w-3 h-3" />
                  {relationshipPill}
                </span>
                )}
                {/* Context label — e.g. pricing rule name, colored by type */}
                {generic && contextLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap shrink-0"
                  style={{
                    fontWeight: 600,
                    backgroundColor: contextType === "premium" ? "#F5F3FF" : "#ECFDF5",
                    color: contextType === "premium" ? "#6D28D9" : "#047857",
                    borderColor: contextType === "premium" ? "#DDD6FE" : "#A7F3D0",
                  }}
                >
                  {contextType === "premium" ? "Premium" : "Discount"}
                  <span className="text-[10px] opacity-60">·</span>
                  {contextLabel}
                </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                {browseDescription}
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit Full" : "Full View"}
              </button>
              <button
                onClick={handleCloseIntent}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Stepper — only on the qualified-vendor (sell) flow, where
              Configure adds a second step. Hidden in generic / purchase
              flows since those commit directly from selection. Mirrors
              the canonical CreatePartnerModal stepper (numbered circle
              + label + active/completed bottom underline) so the modal
              system reads consistently across the module. */}
          {!generic && activeSubTab === "sell" && (
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {[
                {
                  num: 1,
                  label: "Select Items",
                  shortLabel: "Select",
                  active: view === "browse" || view === "added",
                  completed: view === "configure",
                  clickable: view === "configure",
                  onClick: () => setView("browse"),
                },
                {
                  num: 2,
                  label: "Configure Pricing",
                  shortLabel: "Configure",
                  active: view === "configure",
                  completed: false,
                  clickable: (view === "browse" || view === "added") && selectedIds.size > 0,
                  onClick: () => { if (selectedIds.size > 0) handleAdd(); },
                },
              ].map((tab) => (
                <div
                  key={tab.num}
                  className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${tab.clickable ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => { if (tab.clickable) tab.onClick(); }}
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
          )}
        </div>
        )}


        {/* Search + View tabs + Sorting pills — hidden in the Configure
            step since that view has its own header strip. */}
        {view !== "configure" && (
        <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
          {/* Row: Search + View toggle + Count */}
          <div className="flex items-center gap-3">
            {/* Search — leftmost */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder={view === "browse" ? "Search inventory..." : "Search added items..."}
                value={currentSearch}
                onChange={(e) => { setCurrentSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-8 h-8 text-[13px] bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {currentSearch && (
                <button
                  onClick={() => { setCurrentSearch(""); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View toggle — after search */}
            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
              <button
                onClick={() => setView("browse")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                  view === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                }`}
                style={{ fontWeight: view === "browse" ? 600 : 500 }}
              >
                <Package className={`w-3.5 h-3.5 ${view === "browse" ? "text-primary" : "text-slate-400"}`} />
                Browse Inventory
                <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "browse" ? "bg-accent text-primary" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>
                  {available.length}
                </span>
              </button>
              <button
                onClick={() => setView("added")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                  view === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                }`}
                style={{ fontWeight: view === "added" ? 600 : 500 }}
              >
                <Check className={`w-3.5 h-3.5 ${view === "added" ? "text-success" : "text-slate-400"}`} />
                Added Items
                <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "added" ? "bg-emerald-50 text-success" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>
                  {existingItems.length}
                </span>
              </button>
            </div>

            {/* Item count — Added view only. The Browse toolbar drops the
                selected/available counters (stakeholder ask: the footer's
                selected count is the single source). */}
            {view !== "browse" && (
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
                  {currentTotal} items
                </span>
              </div>
            )}
          </div>

          {/* Sorting pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-2.5">
            {/* Restricted-only pill — placed in the leading slot to
                mirror the "Approved to Buy" pill placement on the
                partner-detail Items They Buy tab. Approved Buyer mode
                + browse view only; tooltip explains the gate so the
                user doesn't need a separate banner to learn the rule.
                Painted amber to sync with the row-level Restricted
                pill — both signal "needs approval, handle with care". */}
            {view === "browse" && isApprovedBuyerMode && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setRestrictedOnly((v) => !v); setPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        restrictedOnly
                          ? "border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`}
                      style={{ fontWeight: restrictedOnly ? 500 : 400, color: restrictedOnly ? "#92400E" : undefined }}
                    >
                      <Shield className="w-3 h-3" />
                      Restricted Only
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[280px] z-[300]">
                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Restricted Only</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Filters the catalog to items that actually need approval. Unrestricted items are open to every partner, adding them to the approved-buyer list has no effect.
                    </p>
                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                      <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                        Spinning up a new dealer? Toggle on and the table narrows to just the restricted parts they'll need approval for, skip the open catalog they can already buy.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <div className="w-px h-5 bg-border shrink-0" />
              </>
            )}
            {MODAL_SORT_OPTIONS.map((opt) => {
              const isActive = modalSort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setModalSort(opt.key); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                  }`}
                  style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "rgb(var(--primary))" : undefined }}
                >
                  {opt.label}
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                    style={{ fontWeight: 600, color: isActive ? "rgb(var(--primary))" : "rgb(var(--muted-foreground))" }}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Table — hidden in the Configure step */}
        {view !== "configure" && (
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <Table style={{ tableLayout: "fixed", minWidth: view === "added" ? 2120 : 2060 }}>
            <TableHeader className="sticky top-0 z-20 bg-white">
              <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                  {view === "browse" ? (
                    <Checkbox
                      checked={currentPaginated.length > 0 && currentPaginated.every((it) => selectedIds.has(it.id)) ? true : currentPaginated.some((it) => selectedIds.has(it.id)) ? "indeterminate" : false}
                      onCheckedChange={() => {
                        const allSelected = currentPaginated.every((it) => selectedIds.has(it.id));
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          currentPaginated.forEach((it) => allSelected ? next.delete(it.id) : next.add(it.id));
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <Checkbox
                      checked={currentPaginated.length > 0 && currentPaginated.every((it) => addedSelectedIds.has(it.id)) ? true : currentPaginated.some((it) => addedSelectedIds.has(it.id)) ? "indeterminate" : false}
                      onCheckedChange={() => {
                        const allSelected = currentPaginated.every((it) => addedSelectedIds.has(it.id));
                        setAddedSelectedIds((prev) => {
                          const next = new Set(prev);
                          currentPaginated.forEach((it) => allSelected ? next.delete(it.id) : next.add(it.id));
                          return next;
                        });
                      }}
                    />
                  )}
                </TableHead>
                {/* Header column set mirrors the main partner-detail
                    Items tab — same labels, same default order. The
                    minimum-width math feeds into the Table's minWidth
                    style so columns don't collapse on narrow screens.
                    Item Code header is sticky-left at 40px (right
                    after the checkbox) to match the main tab's frozen
                    Item column behavior. */}
                <TableHead
                  className="text-[11px] text-slate-500 !pl-4 sticky left-[40px] z-20 bg-[#FAFBFC]"
                  style={{ fontWeight: 500, width: 200, minWidth: 200, maxWidth: 200, boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }}
                >Item Code</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 260 }}>Description</TableHead>
                {activeSubTab === "purchase" && (
                  <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 170 }}>Restriction</TableHead>
                )}
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 150 }}>Inventory Control</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 150 }}>Primary Category</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4 text-right" style={{ fontWeight: 500, width: 120 }}>On-Hand Qty</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 110 }}>Base Unit</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 100 }}>Status</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 180 }}>Preferred Acquisition</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 140 }}>Created On</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 200 }}>Created By</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 200 }}>Owner</TableHead>
                {view === "added" && (
                  <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px] min-w-[60px] max-w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                    <span className="text-[13px]" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modalTableLoad.loadState === "loading" ? (
                <TableSkeletonRows columns={view === "added" ? 14 : 13} />
              ) : modalEmptyProps ? (
                <TableEmptyRow colSpan={view === "added" ? 14 : 13} {...modalEmptyProps} />
              ) : (
                currentPaginated.map((item) => renderItemRow(item, view))
              )}
            </TableBody>
          </Table>
        </div>
        )}

        {/* Pagination — matches main items table. Hidden in Configure. */}
        {view !== "configure" && (
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </Button>

            {(() => {
              const pages: (number | "...")[] = [];
              if (currentTotalPages <= 7) { for (let i = 1; i <= currentTotalPages; i++) pages.push(i); }
              else { pages.push(1); if (currentPage > 3) pages.push("..."); for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentTotalPages - 1, currentPage + 1); i++) pages.push(i); if (currentPage < currentTotalPages - 2) pages.push("..."); pages.push(currentTotalPages); }
              return pages.map((p, idx) => p === "..." ? (
                <span key={`d${idx}`} className="px-1 text-muted-foreground text-[13px]">...</span>
              ) : (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 text-[13px] ${
                    currentPage === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setCurrentPage(p as number)}
                >
                  {p}
                </Button>
              ));
            })()}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={currentPage === currentTotalPages}
              onClick={() => setCurrentPage(Math.min(currentTotalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage === currentTotalPages}
              onClick={() => setCurrentPage(currentTotalPages)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        )}

        {/* Configure step — per-item pricing + ordering parameters.
            Triggered by Continue on the Sell sub-tab. Mirrors the
            canonical item-detail Configure Vendor Details modal so
            the same field set captures pricing on both surfaces.
            Fields are grouped into three readable sections
            (Pricing / Order Quantity / Tolerance & Timing) instead of
            a single 7-column grid so the form scans naturally rather
            than reading like a spreadsheet. */}
        {view === "configure" && (() => {
          // Edit-Configuration mode — the row is an existing
          // qualified-vendor item that lives in the partner's added
          // items array, NOT in the global INVENTORY_ITEMS catalog
          // (per-vendor items are generated separately). Pull the
          // single edited item directly so the configure form has
          // something to render.
          const items = editMode && editItem
            ? [editItem]
            : INVENTORY_ITEMS.filter((it) => selectedIds.has(it.id));
          const completeCount = items.filter((it) => {
            const cfg = configById[it.id];
            return cfg && cfg.pricePerUnit.trim() && cfg.uom;
          }).length;
          // Auto-shift focus if the focused item gets removed from the
          // selection (via the rail X). Falls back to the first item or
          // null when nothing's selected.
          const focused = items.find((it) => it.id === focusedItemId) || items[0] || null;
          return (
            <div className="flex-1 min-h-0 overflow-hidden bg-[#F7F9FC] flex flex-col">
              {/* Top bar dropped — the priced count now lives next to
                  the Items to configure header, and Add Item sits
                  inline with that header too. */}
              {/* Split-pane wizard — left rail = items list, right
                  panel = focused item's expandable form. Mirrors the
                  canonical Inventory Movement / item-detail
                  Configure Selected Items flow. */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Left rail — items to configure. Width is 25% of the
                    modal body (rest = right pane); falls back to flex
                    layout below md. Hidden in Edit-Configuration mode
                    since that flow is scoped to a single item — the
                    rail would just hold one row. */}
                {!editMode && (
                <div className="hidden md:flex w-[25%] shrink-0 border-r border-[#EEF2F6] bg-white flex-col">
                  <div className="px-3 py-2.5 border-b border-[#EEF2F6] shrink-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>Items to Configure</p>
                      <p className="text-[10px] text-slate-400 mt-px">{items.length} selected · {completeCount} priced</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView("browse")}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E8ECF1] bg-white text-[11px] text-slate-700 hover:border-primary/40 hover:text-primary hover:bg-accent/50 transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                      title="Add more items to configure"
                    >
                      <Plus className="w-3 h-3" />
                      Add More Items
                    </button>
                  </div>
                  {/* Search the rail — visible whenever there's at least
                      one item so the user can always filter. Clear (X)
                      button appears when there's a query; matched runs
                      get highlighted in the row labels below. */}
                  {items.length > 0 && (
                    <div className="px-3 py-2 border-b border-[#EEF2F6] shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                          value={configureRailSearch}
                          onChange={(e) => setConfigureRailSearch(e.target.value)}
                          placeholder="Search items..."
                          className="h-8 pl-8 pr-8 text-[12px] bg-white border-[#E8ECF1]"
                        />
                        {configureRailSearch && (
                          <button
                            type="button"
                            onClick={() => setConfigureRailSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="Clear Search"
                            title="Clear Search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                    {(() => {
                      const railQuery = configureRailSearch.trim().toLowerCase();
                      const railItems = railQuery
                        ? items.filter(
                            (it) =>
                              it.partNo.toLowerCase().includes(railQuery) ||
                              it.description.toLowerCase().includes(railQuery) ||
                              (it.category || "").toLowerCase().includes(railQuery)
                          )
                        : items;
                      // Local highlight helper — wraps the matched substring
                      // in a soft yellow mark. Case-insensitive; first match
                      // per field. Returns the original string when there's
                      // no query so non-search rows stay as plain text.
                      const highlightMatch = (text: string, query: string): React.ReactNode => {
                        if (!query.trim()) return text;
                        const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
                        if (idx < 0) return text;
                        const q = query.trim();
                        return (
                          <>
                            {text.slice(0, idx)}
                            <mark className="bg-amber-100 text-foreground rounded-sm px-px">{text.slice(idx, idx + q.length)}</mark>
                            {text.slice(idx + q.length)}
                          </>
                        );
                      };
                      if (railItems.length === 0 && railQuery) {
                        return (
                          <div className="flex flex-col items-center gap-1.5 py-8 text-slate-400">
                            <Search className="w-5 h-5" />
                            <p className="text-[11px]" style={{ fontWeight: 500 }}>No items match "{configureRailSearch}"</p>
                            <button
                              type="button"
                              onClick={() => setConfigureRailSearch("")}
                              className="text-[11px] text-primary hover:underline cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              Clear Search
                            </button>
                          </div>
                        );
                      }
                      return railItems.map((it) => {
                      const cfg = configById[it.id];
                      const priced = !!cfg?.pricePerUnit?.trim();
                      const isFocused = focused?.id === it.id;
                      /* Same next-free-slot resolution as the Priority
                       * Select inside Item Configuration — the rail
                       * preview shows the slot the new partner will
                       * actually land in, not just its position in the
                       * selection list. */
                      const railOtherQvs = getOtherQualifiedVendors(it.id, partnerId, _allVendorsForOtherQvs);
                      const railUsed = new Set(railOtherQvs.map((v) => v.priority));
                      let railNextFree = 1;
                      while (railUsed.has(railNextFree)) railNextFree += 1;
                      const resolvedPriority = !cfg?.priority || cfg.priority === "auto" ? railNextFree : Number(cfg.priority);
                      return (
                        <div
                          key={it.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setFocusedItemId(it.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocusedItemId(it.id); } }}
                          className={`group relative flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isFocused ? "bg-[#EBF3FF] ring-1 ring-[#A8D2FF]" : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r transition-opacity ${isFocused ? "bg-primary opacity-100" : "opacity-0"}`}
                          />
                          <img src={it.image} alt={it.partNo} className="w-9 h-9 rounded-md object-cover border border-[#E8ECF1] shrink-0 ml-1" />
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12px] truncate ${isFocused ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 600 }}>{highlightMatch(it.partNo, configureRailSearch)}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-px">{highlightMatch(it.description, configureRailSearch)}</p>
                          </div>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); next.delete(it.id); return next; }); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); next.delete(it.id); return next; }); } }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                            aria-label="Remove from Selection"
                          >
                            <Trash2 className="w-3 h-3" />
                          </span>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
                )}

                {/* Right panel — focused item form */}
                <div className="flex-1 min-w-0 overflow-y-auto">
                  {!focused ? (
                    <div className="h-full flex items-center justify-center px-6 py-12">
                      <div className="rounded-xl border border-dashed border-[#E8ECF1] bg-white px-8 py-12 text-center max-w-md">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>No items left to configure</p>
                        <p className="text-[12px] text-slate-500 mt-1">Go back to selection and pick at least one item.</p>
                        <button
                          type="button"
                          onClick={() => setView("browse")}
                          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Back to Selection
                        </button>
                      </div>
                    </div>
                  ) : (() => {
                    const it = focused;
                    const idx = items.findIndex((x) => x.id === it.id);
                    const cfg: QualifiedVendorConfig = configById[it.id] || {
                      priority: "auto", pricePerUnit: "", uom: ON_HAND_UNIT_TO_UOM[it.onHandUnit] || "Each",
                      minOrderQty: "", maxOrderQty: "", multiples: "", acceptedDeviationPct: "", leadTimeDays: "",
                      locationId: "", shippingMethodIds: [], defaultShippingMethodId: "", appliedPricingRuleIds: [],
                    };
                    const priced = !!cfg.pricePerUnit.trim();
                    const shippingMethodIds = cfg.shippingMethodIds || [];
                    const appliedRuleIds = cfg.appliedPricingRuleIds || [];
                    /* Location scope — vendor priority and price per unit are
                     * PARTNER-level values; a location can never hold its own.
                     * Already qualified with the partner → both fields lock
                     * (read-only, sourced from the partner record). First-time
                     * qualification → editable, but flagged as being set for
                     * the whole partner (every location shares them). */
                    const isLocationScope = !!locationName;
                    /* Edit-Configuration from a location always locks: an item
                     * on the location's list is by definition already
                     * qualified with the partner, and priority/price can never
                     * diverge per location. (Pending the edit-config redesign
                     * user story, this keeps the finalized rule enforced.) */
                    const lockedFromPartner = isLocationScope && (editMode || !!partnerQualifiedIds?.has(it.id));
                    return (
                      <>
                        {/* Sticky top block — the location-scope banner and
                            the focused-item header pin together so the
                            partner-level context stays visible while the
                            form scrolls (same always-visible treatment as
                            the creation form's overridden banner). */}
                        <div className="sticky top-0 z-20 bg-white">
                        {/* Location-scope banner — same amber strip as the
                            creation form's "group defaults overridden"
                            banner, pinned to the top of the configure
                            panel. Two states per the finalized rule:
                            Case A (item already qualified with the
                            partner) → the grayed sections are inherited;
                            Case B (first-time qualification) → the values
                            set here live at the partner level. */}
                        {/* Solid amber (not /70) — the strip is sticky, so a
                            translucent fill would let scrolled content bleed
                            through and merge with the banner. */}
                        {isLocationScope && (
                          <div className="border-b px-4 py-2 flex items-center gap-2.5 bg-[#FFFBEB] border-amber-200">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-200 text-amber-700 shrink-0">
                              {lockedFromPartner ? <Lock className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                            </span>
                            <p className="text-[11px] text-amber-900 min-w-0 flex-1 leading-snug" style={{ fontWeight: 500 }}>
                              {lockedFromPartner ? (
                                <>
                                  <span style={{ fontWeight: 700 }}>Inherited from {_currentPartnerName}.</span>
                                  {" "}The grayed-out sections are set at the partner level and are identical across all of its locations — to make changes, edit this item's configuration on the partner.
                                </>
                              ) : (
                                <>
                                  <span style={{ fontWeight: 700 }}>First-time setup.</span>
                                  {" "}Vendor priority, pricing &amp; ordering rules, and pricing rules are configured at the{" "}
                                  <span style={{ fontWeight: 700 }}>{_currentPartnerName}</span>
                                  {" "}level and shared across all of its locations, so changes made here apply to every location.
                                </>
                              )}
                            </p>
                          </div>
                        )}
                        {/* Focused-item header — sticky to the top of the
                            right-pane scroll container so the user always
                            knows which item they're configuring. White
                            base + a small amber "Pending" chip when the
                            row's price isn't filled yet (per stakeholder:
                            keep the surface white, lean on a chip — not
                            a full yellow background — to flag pending).
                            Hidden in Edit-Configuration mode — the outer
                            modal header already carries the same item
                            info. */}
                        {!editMode && (
                        <div className="bg-white border-b border-[#EEF2F6] px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-3">
                            <img src={it.image} alt={it.partNo} className="w-10 h-10 rounded-lg object-cover border border-[#E8ECF1] shrink-0" />
                            <div className="min-w-0 flex-1">
                              {/* Rich metadata pill row — mirrors the Items
                                  module header so the surface reads with the
                                  same context (status, acquisition, manufacturer,
                                  category). Pills are visual-only here; the
                                  source of truth still lives on the Items
                                  module. */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[14px] text-foreground tracking-[-0.005em] mr-1" style={{ fontWeight: 600 }}>{it.partNo}</p>
                                {/* Status — emerald for Active, amber for Inactive (no leading dot) */}
                                <span
                                  className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${
                                    it.status === "Active"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                  style={{ fontWeight: 600 }}
                                >
                                  {it.status}
                                </span>
                                {/* Acquisition — dark neutral square pill */}
                                <span
                                  className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] border bg-slate-100 text-slate-700 border-slate-200"
                                  style={{ fontWeight: 600 }}
                                  title={`Preferred acquisition: ${it.preferredAcquisition}`}
                                >
                                  {it.preferredAcquisition}
                                </span>
                                {/* Manufacturer — sky pill with factory icon */}
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] border bg-sky-50 text-sky-700 border-sky-200"
                                  style={{ fontWeight: 600 }}
                                  title={`Manufacturer: ${it.manufacturer}`}
                                >
                                  <Building2 className="w-2.5 h-2.5" />
                                  {it.manufacturer}
                                </span>
                                {/* Primary category — violet pill. When a second
                                    category exists, append "+1 more" inline
                                    inside the same pill so the overflow stays
                                    visually attached to the parent value. */}
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] border bg-violet-50 text-violet-700 border-violet-200"
                                  style={{ fontWeight: 600 }}
                                  title={it.additionalCategory ? `Also: ${it.additionalCategory}` : undefined}
                                >
                                  {it.category}
                                  {it.additionalCategory && (
                                    <span className="text-violet-500" style={{ fontWeight: 600 }}>+1 more</span>
                                  )}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-1">{it.description}</p>
                            </div>
                          </div>
                        </div>
                        )}
                        </div>
                        <div className="p-4 sm:p-5 space-y-3">

                        {/* Section: Item Configuration — required fields up
                            top (Priority, Pricing); the optional ordering
                            rules (Min/Max/Multiples + Deviation + Lead
                            Time) sit behind a checkbox so the default form
                            stays focused. Location field removed — the
                            modal is already location-scoped at the point
                            of use. */}
                        {(() => {
                          const open = openSections.has("config");
                          /* Advanced ordering rules default to ON — Eli's
                           * ask: most QV configs need to set Min/Max/lead
                           * time at a minimum, so the affordance should
                           * be expanded from the start. The set now
                           * tracks items where the user has explicitly
                           * turned the section OFF, so the absence of an
                           * entry means ON. */
                          const advancedOn = !advancedOrderingIds.has(it.id);
                          /* Tier-grouped priority roster — ported from the
                           * Items module's Add Qualified Vendors flow so both
                           * surfaces share one priority model. Priority is a
                           * free, tie-allowing rank: several vendors can hold
                           * the same level, and exactly one Priority 1 vendor
                           * can be starred as the primary (auto-PO anchor).
                           * Raw ranks live in qvTiersById; absent entry =
                           * seeded layout (existing QVs at their saved rank,
                           * the draft appended below them — Eli's ask: never
                           * silently bump whoever already holds a slot). */
                          const otherQvsForPriority = getOtherQualifiedVendors(it.id, partnerId, _allVendorsForOtherQvs);
                          const additionalPrices = cfg.additionalPrices || [];
                          const rawOverrides = qvTiersById[it.id];
                          const maxExistingRaw = otherQvsForPriority.reduce((m, v) => Math.max(m, v.priority), 0);
                          const draftSeedRaw = !cfg.priority || cfg.priority === "auto" ? maxExistingRaw + 1 : Number(cfg.priority);
                          const primaryKey = qvPrimaryById[it.id] !== undefined
                            ? qvPrimaryById[it.id]
                            : (cfg.isPrimaryVendor ? "__draft__" : null);
                          const formatLeadTime = (days: number) => {
                            if (days <= 0) return "—";
                            if (days < 7) return `${days} ${days === 1 ? "day" : "days"}`;
                            const wks = Math.round((days / 7) * 10) / 10;
                            return `${wks} wk${wks === 1 ? "" : "s"}`;
                          };
                          const rosterInput: RosterInputVendor[] = [
                            ...otherQvsForPriority.map((v) => ({
                              id: v.vendorId,
                              name: v.vendorName,
                              profileImage: v.profileImage,
                              isDraft: false,
                              priority: rawOverrides?.[v.vendorId] ?? v.priority,
                              isDefault: primaryKey === v.vendorId,
                              priceLabel: `$${v.price.toFixed(2)}`,
                              uomLabel: v.uom,
                              leadLabel: formatLeadTime(v.leadTimeDays),
                              priced: true,
                            })),
                            {
                              id: "__draft__",
                              name: _currentPartnerName,
                              isDraft: true,
                              priority: rawOverrides?.["__draft__"] ?? draftSeedRaw,
                              isDefault: primaryKey === "__draft__",
                              priceLabel: cfg.pricePerUnit.trim() ? `$${cfg.pricePerUnit}` : "—",
                              uomLabel: cfg.uom || "Each",
                              leadLabel: formatLeadTime(cfg.leadTimeDays ? Number(cfg.leadTimeDays) : 0),
                              priced: !!cfg.pricePerUnit.trim(),
                            },
                          ];
                          /* Within-tie sequence: honor the user's explicit
                           * flat order when they've dragged; computeRoster
                           * groups by tier, so this only sequences cards that
                           * SHARE a priority level. */
                          const storedOrder = qvOrderById[it.id];
                          if (storedOrder) {
                            const pos = new Map(storedOrder.map((id, i) => [id, i]));
                            rosterInput.sort((a, b) => (pos.get(a.id) ?? rosterInput.length) - (pos.get(b.id) ?? rosterInput.length));
                          }
                          const roster = computeRoster(rosterInput);
                          const draftTier = roster.tierByKey["__draft__"] ?? 1;
                          const rosterTierCount = new Set(roster.cards.map((c) => c.priority)).size;
                          /* Mark this item's primary vendor. Persist the
                           * draft's flag on its config so it survives save;
                           * flags on existing vendors stay session-local
                           * (production writes them to the QV index). */
                          const setPrimaryFor = (key: string | null) => {
                            setQvPrimaryById((prev) => ({ ...prev, [it.id]: key }));
                            updateItemConfig(it.id, { isPrimaryVendor: key === "__draft__" });
                          };
                          /* Commit a full raw-rank map for this item. Keeps
                           * cfg.priority in sync with the draft's densified
                           * tier (the rail preview + save payload read it) and
                           * clears the primary flag if its holder left the top
                           * level — the anchor is Priority 1 only. */
                          const commitRoster = (raws: Record<string, number>, flatOrder?: string[]) => {
                            setQvTiersById((prev) => ({ ...prev, [it.id]: raws }));
                            if (flatOrder) setQvOrderById((prev) => ({ ...prev, [it.id]: flatOrder }));
                            const distinct = Array.from(new Set(Object.values(raws))).sort((a, b) => a - b);
                            const toTier = new Map(distinct.map((r, i) => [r, Math.min(i + 1, MAX_PRIORITY)]));
                            updateItemConfig(it.id, { priority: String(toTier.get(raws["__draft__"]) ?? 1) });
                            if (primaryKey && toTier.get(raws[primaryKey]) !== 1) setPrimaryFor(null);
                          };
                          const currentRaws = (): Record<string, number> => {
                            const raws: Record<string, number> = {};
                            roster.cards.forEach((c) => { raws[c.key] = c.priority; });
                            return raws;
                          };
                          /* Visual order — tier-grouped, stable within a tier.
                           * All flat-order writes go through this so the list
                           * the user sees and the stored sequence agree. */
                          const visualKeys = [...roster.cards].sort((a, b) => a.priority - b.priority).map((c) => c.key);
                          /* LANE / card-middle drop — place the card at an
                           * explicit level, joining/sharing it (a tie). The
                           * card lands at the END of that level's members so
                           * the drop shows up where the eye expects. */
                          const handleRosterSetPriority = (key: string, tier: number) => {
                            const raws = currentRaws();
                            raws[key] = tier;
                            const rest = visualKeys.filter((k) => k !== key);
                            let insertAt = 0;
                            rest.forEach((k, i) => { if ((roster.tierByKey[k] ?? MAX_PRIORITY) <= tier) insertAt = i + 1; });
                            rest.splice(insertAt, 0, key);
                            commitRoster(raws, rest);
                          };
                          /* INSERTION-LINE drop — reposition in the ranked
                           * order; the landing rank derives from the new
                           * neighbours (between two tied cards joins the tie,
                           * between two tiers takes a fresh rank). */
                          const handleRosterReposition = (key: string, beforeKey: string | null) => {
                            const current = visualKeys;
                            const flat = current.filter((k) => k !== key);
                            const insertAt = beforeKey == null ? flat.length : (flat.indexOf(beforeKey) === -1 ? flat.length : flat.indexOf(beforeKey));
                            flat.splice(insertAt, 0, key);
                            if (flat.length === current.length && flat.every((k, i) => k === current[i])) return;
                            const tierOf = (k: string) => roster.tierByKey[k] ?? MAX_PRIORITY;
                            const curTier = tierOf(key);
                            const prevK = insertAt > 0 ? flat[insertAt - 1] : null;
                            const nextK = insertAt < flat.length - 1 ? flat[insertAt + 1] : null;
                            const aboveTier = prevK != null ? tierOf(prevK) : null;
                            const belowTier = nextK != null ? tierOf(nextK) : null;
                            let newRank: number;
                            if (aboveTier != null && belowTier != null && aboveTier === belowTier) {
                              newRank = aboveTier; // strictly between two tied cards -> join that tie
                            } else if (aboveTier == null) {
                              // Top boundary: stay in the top tier when already
                              // there (reorder within the tie), else take a
                              // fresh top rank.
                              newRank = belowTier === curTier ? curTier : (belowTier ?? 1) - 0.5;
                            } else if (belowTier == null) {
                              newRank = aboveTier === curTier ? curTier : aboveTier + 0.5;
                            } else {
                              newRank = (aboveTier + belowTier) / 2; // between two tiers -> own rank
                            }
                            // Re-densify the WHOLE roster from the new rank so
                            // stored raws always equal displayed tiers.
                            const rawOf = (k: string) => (k === key ? newRank : tierOf(k));
                            const distinct = Array.from(new Set(flat.map(rawOf))).sort((a, b) => a - b);
                            const tierMap = new Map(distinct.map((v, i) => [v, Math.min(i + 1, MAX_PRIORITY)]));
                            const raws: Record<string, number> = {};
                            flat.forEach((k) => { raws[k] = tierMap.get(rawOf(k))!; });
                            commitRoster(raws, flat);
                          };
                          const handleRosterToggleDefault = (key: string) => {
                            if (roster.tierByKey[key] !== 1) return;
                            setPrimaryFor(primaryKey === key ? null : key);
                          };
                          /* Delete a priority lane: its vendors merge up into
                           * the lane above, lower lanes shift up one rank. */
                          const handleRosterDeleteLane = (tier: number) => {
                            const raws = currentRaws();
                            Object.keys(raws).forEach((k) => {
                              const t = raws[k];
                              raws[k] = Math.max(1, t === tier ? tier - 1 : t > tier ? t - 1 : t);
                            });
                            commitRoster(raws);
                          };
                          return (
                            <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                              <button type="button" onClick={() => toggleSection("config")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                <div className="flex items-center gap-2.5">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <Settings2 className="w-3.5 h-3.5 text-[#4338CA]" />
                                  </span>
                                  <div>
                                    <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Item Configuration</p>
                                    <p className="text-[11px] text-slate-500 mt-px">Priority and pricing for this qualified-vendor row.</p>
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                              </button>
                              {/* Animated reveal — uses the grid-template-rows
                                  0fr→1fr trick so the section glides open
                                  instead of snapping. Inner overflow-hidden
                                  clips content during the animation; the
                                  content itself stays mounted so DOM measurements
                                  don't need refreshing. */}
                              <div
                                aria-hidden={!open}
                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                              >
                                <div className="overflow-hidden">
                                  <div className="border-t border-[#EEF2F6] px-4 sm:px-5 py-5 bg-white">
                                  {/* Two-column layout:
                                      Left  = Priority + Price stack (primary
                                              fields the user must fill on
                                              every row).
                                      Right = Advanced ordering rules sub-
                                              section (optional toggle, can
                                              grow downward when expanded).
                                      The columns are independent — the
                                      right side stays anchored at the top
                                      even when the user adds many UoM
                                      tiers on the left. */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                                    {/* Left column — Vendor Priority list only.
                                        Eli's pass: priority is its own focused
                                        column; pricing + ordering rules live on
                                        the right next to each other. */}
                                    <div>
                                      {/* Inline priority panel — Eli's pass: drop
                                          the outer label too (the card's own
                                          header carries the title, icon, and
                                          roster count). Keeps both columns
                                          visually aligned at the top. */}
                                      <InheritedSectionTooltip active={lockedFromPartner} partnerName={_currentPartnerName}>
                                      <div className="rounded-xl border border-violet-200 bg-white overflow-hidden flex flex-col h-full max-h-[620px]">
                                          {/* Header — soft violet treatment.
                                              Matching colored treatment on the
                                              Vendor Pricing card on the right
                                              (different hue) gives the two
                                              columns parallel weight without
                                              washing into the form body. */}
                                          <div className="px-3.5 py-3 border-b border-violet-200 bg-[#FAF5FF] flex items-start gap-3 shrink-0">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EDE9FE] border border-violet-200 shrink-0">
                                              <ListOrdered className="w-3.5 h-3.5 text-violet-600" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-[13px] text-violet-800" style={{ fontWeight: 600 }}>Vendor Priority</p>
                                                <span className="text-[11px] text-slate-400">·</span>
                                                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                                  {otherQvsForPriority.length === 0
                                                    ? "Top of priority list"
                                                    : `Priority ${draftTier} of ${rosterTierCount} ${rosterTierCount === 1 ? "level" : "levels"}`}
                                                </span>
                                                {lockedFromPartner && (
                                                  <span
                                                    className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9.5px] border bg-white text-slate-500 border-slate-200"
                                                    style={{ fontWeight: 600 }}
                                                  >
                                                    <Lock className="w-2.5 h-2.5" />
                                                    Set at Partner
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-px truncate" style={{ fontWeight: 400 }}>
                                                {lockedFromPartner
                                                  ? `Managed at the partner level — every location shares this ranking.`
                                                  : otherQvsForPriority.length === 0
                                                    ? "Top slot until more vendors rank against this one."
                                                    : "Drop a card onto a vendor to share its level, between cards to reorder. Star a Priority 1 vendor to mark it primary."}
                                              </p>
                                            </div>
                                            {!lockedFromPartner && (cfg.priority !== "auto" || rawOverrides || storedOrder) && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  updateItemConfig(it.id, { priority: "auto" });
                                                  setQvTiersById((prev) => {
                                                    const next = { ...prev };
                                                    delete next[it.id];
                                                    return next;
                                                  });
                                                  setQvOrderById((prev) => {
                                                    const next = { ...prev };
                                                    delete next[it.id];
                                                    return next;
                                                  });
                                                }}
                                                className="text-[11px] text-primary hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                                                style={{ fontWeight: 600 }}
                                              >
                                                Reset Priority
                                              </button>
                                            )}
                                          </div>
                                          {/* Tier-grouped roster — the ported Items-
                                              module priority list. Lanes are drop
                                              targets (join a level / share a tie),
                                              card edges reposition via the insertion
                                              line, the star on Priority 1 cards marks
                                              the primary vendor. Scrolls internally
                                              when the lanes outgrow the panel. */}
                                          <VendorPriorityList
                                            cards={roster.cards}
                                            onSetPriority={handleRosterSetPriority}
                                            onReposition={handleRosterReposition}
                                            onToggleDefault={handleRosterToggleDefault}
                                            onDeleteLane={handleRosterDeleteLane}
                                            readOnly={lockedFromPartner}
                                            draftBadge={lockedFromPartner ? "Qualified at Partner" : undefined}
                                          />
                                      </div>
                                      </InheritedSectionTooltip>
                                    </div>
                                    {/* Right column — Pricing + Advanced ordering
                                        rules stacked. space-y-4 mirrors the gap
                                        the old LEFT column used. */}
                                    <div className="space-y-4">
                                    <div>
                                      {/* Vendor Pricing — single outer section
                                          (parallel to the Vendor priority panel
                                          on the left). Inner cards represent one
                                          per-UoM price row each, with the price
                                          input always visible and the rest of
                                          the rules hidden behind an "Additional
                                          configuration" toggle for a cleaner
                                          first read. */}
                                      <InheritedSectionTooltip active={lockedFromPartner} partnerName={_currentPartnerName}>
                                      <div className="rounded-xl border border-blue-200 bg-white overflow-hidden flex flex-col h-full">
                                      {/* Outer section header — soft blue to
                                          parallel the violet on the Vendor
                                          priority panel. Distinct colors so the
                                          two columns are scannable at a glance. */}
                                      <div className="px-3.5 py-3 border-b border-blue-200 bg-[#F5F9FF] flex items-center gap-3 shrink-0">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#CFE6FF] border border-blue-200 shrink-0">
                                          <Tag className="w-3.5 h-3.5 text-primary" />
                                        </span>
                                        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                          <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Pricing &amp; Ordering Rules</p>
                                          <span className="text-[11px] text-slate-400">·</span>
                                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                            {additionalPrices.length + 1} {additionalPrices.length === 0 ? "selling unit" : "selling units"}
                                          </span>
                                          {lockedFromPartner && (
                                            <span
                                              className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9.5px] border bg-white text-slate-500 border-slate-200"
                                              style={{ fontWeight: 600 }}
                                            >
                                              <Lock className="w-2.5 h-2.5" />
                                              Set at Partner
                                            </span>
                                          )}
                                        </div>
                                        {/* Apply-to-all popover — copies the
                                            unit-agnostic rules (deviation %,
                                            lead time) across every pack on
                                            this item. Quantity-based fields
                                            (min/max/multiples) are excluded
                                            because they only make sense in
                                            the context of each pack's UoM. */}
                                        {additionalPrices.length > 0 && !lockedFromPartner && (
                                          <Popover open={bulkPopoverOpen} onOpenChange={setBulkPopoverOpen}>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-blue-200 bg-white text-[11px] text-primary hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                                                style={{ fontWeight: 600 }}
                                              >
                                                <Layers className="w-3 h-3" />
                                                Apply to All
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" sideOffset={6} className="w-[340px] p-0 z-[260] border-[#E8ECF1] shadow-[0_12px_40px_-8px_rgba(15,23,42,0.18)]">
                                              <div className="px-4 py-3 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#EEF2FF] border border-[#E0E7FF] shrink-0">
                                                  <Layers className="w-3.5 h-3.5 text-[#4338CA]" />
                                                </span>
                                                <div className="min-w-0">
                                                  <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Apply to All Packs</p>
                                                  <p className="text-[10px] text-slate-500 mt-px">Quantity rules stay per-unit, different units, different quantities.</p>
                                                </div>
                                              </div>
                                              <div className="px-4 py-3 space-y-3 max-h-[55vh] overflow-y-auto">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Deviation %</label>
                                                    <Input inputMode="decimal" value={bulkConfigDraft.acceptedDeviationPct} onChange={(e) => setBulkConfigDraft((p) => ({ ...p, acceptedDeviationPct: numericInput(e.target.value, { decimal: true }) }))} placeholder="0" className="h-8 text-[12px]" />
                                                  </div>
                                                  <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Lead Time (days)</label>
                                                    <Input inputMode="numeric" value={bulkConfigDraft.leadTimeDays} onChange={(e) => setBulkConfigDraft((p) => ({ ...p, leadTimeDays: numericInput(e.target.value) }))} placeholder="0" className="h-8 text-[12px]" />
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="px-4 py-2.5 border-t border-[#EEF2F6] bg-white flex items-center justify-between gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => setBulkConfigDraft((p) => ({ ...p, acceptedDeviationPct: "", leadTimeDays: "" }))}
                                                  className="h-8 px-2.5 rounded-md text-[11px] text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                                                  style={{ fontWeight: 500 }}
                                                >
                                                  Clear
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const draft = bulkConfigDraft;
                                                    const pick = <T extends string | undefined>(draftVal: string, curVal: T): T | string => draftVal && draftVal.trim() ? draftVal : (curVal as T);
                                                    updateItemConfig(it.id, {
                                                      acceptedDeviationPct: pick(draft.acceptedDeviationPct, cfg.acceptedDeviationPct),
                                                      leadTimeDays: pick(draft.leadTimeDays, cfg.leadTimeDays),
                                                      additionalPrices: (cfg.additionalPrices || []).map((t) => ({
                                                        ...t,
                                                        acceptedDeviationPct: pick(draft.acceptedDeviationPct, t.acceptedDeviationPct ?? "") as string,
                                                        leadTimeDays: pick(draft.leadTimeDays, t.leadTimeDays ?? "") as string,
                                                      })),
                                                    });
                                                    toast.success(`Rules applied to ${additionalPrices.length + 1} selling unit${additionalPrices.length + 1 === 1 ? "" : "s"}.`);
                                                    setBulkPopoverOpen(false);
                                                  }}
                                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  <Check className="w-3.5 h-3.5" />
                                                  Apply to {additionalPrices.length + 1} Units
                                                </button>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                      {/* Inner card list — grayed out wholesale in
                                          location scope when the item is already
                                          qualified with the partner: every value
                                          here is partner-level, so the section is
                                          a read-only snapshot. */}
                                      <div className={`p-3 space-y-2.5 flex-1 min-h-0 overflow-y-auto ${lockedFromPartner ? "bg-[#FAFBFC] opacity-60 pointer-events-none select-none" : "bg-white"}`} aria-disabled={lockedFromPartner || undefined}>
                                        {/* Primary card — Additional configuration
                                            defaults to OPEN. The Set tracks the
                                            user's manual override (off the
                                            default), so for primary cards in the
                                            set means the user manually closed
                                            it; everything else stays open. */}
                                        {(() => {
                                          const cardKey = `${it.id}:p`;
                                          const expanded = !pricingConfigOpen.has(cardKey);
                                          // Base card is primary unless the draft
                                          // pointer names one of the tier cards.
                                          const pti = cfg.primaryTierIndex;
                                          const basePrimary = pti == null || pti < 0 || pti >= additionalPrices.length;
                                          return (
                                        <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                          <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor Sells As</p>
                                            {/* Canonical Primary pill — same component
                                                as POC / carrier / payment method so
                                                primary indicators read identically
                                                everywhere. The marker moves between
                                                cards in place; the reorder happens
                                                at save time (normalizePrimaryTier). */}
                                            {basePrimary ? (
                                              <PrimaryPill className="shrink-0" />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  updateItemConfig(it.id, { primaryTierIndex: -1 });
                                                  toast.success(`${lookupUom(cfg.uom || "Each").label} is now the primary selling unit.`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                                                style={{ fontWeight: 500 }}
                                                aria-label="Set as primary selling unit"
                                                title="Set as primary selling unit"
                                              >
                                                <Star className="w-3 h-3" />
                                                Set as Primary
                                              </button>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {(() => {
                                              const u = lookupUom(cfg.uom || "Each");
                                              return (
                                                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[#EBF3FF] border border-blue-200 text-[11px] text-primary" style={{ fontWeight: 600 }}>
                                                  {u.label}
                                                  <span className="text-primary/55 text-[10px]" style={{ fontWeight: 500 }}>{u.symbol}</span>
                                                </span>
                                              );
                                            })()}
                                            {additionalPrices.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const [promoted, ...rest] = additionalPrices;
                                                  // First tier slides into the base slot,
                                                  // so a pointer at tier 0 (or at the
                                                  // deleted base) resolves to the base
                                                  // card; later tiers shift down one.
                                                  const pti = cfg.primaryTierIndex;
                                                  updateItemConfig(it.id, {
                                                    pricePerUnit: promoted.price,
                                                    uom: promoted.uom,
                                                    additionalPrices: rest,
                                                    minOrderQty: promoted.minOrderQty ?? "",
                                                    maxOrderQty: promoted.maxOrderQty ?? "",
                                                    multiples: promoted.multiples ?? "",
                                                    acceptedDeviationPct: promoted.acceptedDeviationPct ?? "",
                                                    leadTimeDays: promoted.leadTimeDays ?? "",
                                                    primaryTierIndex: pti != null && pti > 0 ? pti - 1 : undefined,
                                                  });
                                                }}
                                                className="w-6 h-6 rounded-md text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
                                                title="Remove this selling unit"
                                                aria-label="Remove this selling unit"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                          </div>
                                          <div className="p-3 space-y-3">
                                            {/* Price per unit — labelled field
                                                with FieldInfo. Sits above the
                                                ordering rule grid, separated
                                                by a dotted divider so the
                                                hierarchy reads "price first,
                                                rules second". */}
                                            <div>
                                              <label className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                Price per Unit
                                                <FieldInfo content="The unit price this partner charges for this item, expressed in the chosen unit of measure. The price does NOT convert between pack sizes, each pack carries its own rate. Quantities still convert at PO time." />
                                                {lockedFromPartner && (
                                                  <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-px rounded-md text-[9.5px] border bg-slate-50 text-slate-500 border-slate-200" style={{ fontWeight: 600 }}>
                                                    <Lock className="w-2.5 h-2.5" />
                                                    Set at Partner
                                                  </span>
                                                )}
                                              </label>
                                              <div className={`flex items-stretch rounded-lg border border-border overflow-hidden ${lockedFromPartner ? "bg-[#F8FAFC]" : "bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"}`}>
                                                <span className="inline-flex items-center justify-center w-9 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border" style={{ fontWeight: 500 }}>$</span>
                                                <Input
                                                  inputMode="decimal"
                                                  value={cfg.pricePerUnit}
                                                  onChange={(e) => updateItemConfig(it.id, { pricePerUnit: numericInput(e.target.value, { decimal: true }) })}
                                                  placeholder="0.00"
                                                  disabled={lockedFromPartner}
                                                  title={lockedFromPartner ? `Price per unit is set on ${_currentPartnerName} and shared by every location.` : undefined}
                                                  className={`h-9 text-[13px] border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none flex-1 min-w-0 ${lockedFromPartner ? "bg-transparent text-slate-500 disabled:opacity-100 disabled:cursor-not-allowed" : ""}`}
                                                />
                                                <div className={lockedFromPartner ? "pointer-events-none opacity-60" : "contents"}>
                                                  <UomPicker
                                                    variant="embedded"
                                                    value={cfg.uom}
                                                    onChange={(v) => updateItemConfig(it.id, { uom: v })}
                                                    disabledIds={new Set(additionalPrices.map((t) => t.uom))}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                            {/* Dotted divider — separates price
                                                from the ordering rules below. */}
                                            <div className="border-t border-dashed border-[#E2E8F0]" />
                                            {/* Ordering rules grid */}
                                            <div className="grid grid-cols-3 gap-2">
                                              <label className="block">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                  Min Order
                                                  <FieldInfo content="Smallest quantity that can be ordered in a single PO line for this pack size. Orders below this are rejected at submit." />
                                                </span>
                                                <Input inputMode="numeric" value={cfg.minOrderQty} onChange={(e) => updateItemConfig(it.id, { minOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                              </label>
                                              <label className="block">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                  Max Order
                                                  <FieldInfo content="Largest quantity that can be ordered in a single PO line. Leave blank for no cap. Useful when the partner can't fulfil oversized requests in one go." />
                                                </span>
                                                <Input inputMode="numeric" value={cfg.maxOrderQty} onChange={(e) => updateItemConfig(it.id, { maxOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                              </label>
                                              <label className="block">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                  Multiples
                                                  <FieldInfo content="Quantities must be a multiple of this number (e.g. 12 = case packs of 12). Set to 1 for any-quantity orders." />
                                                </span>
                                                <Input inputMode="numeric" value={cfg.multiples} onChange={(e) => updateItemConfig(it.id, { multiples: numericInput(e.target.value) })} placeholder="1" className="h-9 text-[13px]" />
                                              </label>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <label className="block">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                  Accepted Deviation %
                                                  <FieldInfo content="Allowed over- or under-ship as a % of the ordered quantity. e.g. 5 means shipping within ±5% of the PO is accepted without exception." />
                                                </span>
                                                <div className="relative">
                                                  <Input inputMode="decimal" value={cfg.acceptedDeviationPct} onChange={(e) => updateItemConfig(it.id, { acceptedDeviationPct: numericInput(e.target.value, { decimal: true }) })} placeholder="0" className="h-9 text-[13px] pr-7" />
                                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>%</span>
                                                </div>
                                              </label>
                                              <label className="block">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                  Lead Time
                                                  <FieldInfo content="Typical days between order placement and delivery for this pack size from this partner. Drives promise dates and replenishment planning downstream." />
                                                </span>
                                                <div className="relative">
                                                  <Input inputMode="numeric" value={cfg.leadTimeDays} onChange={(e) => updateItemConfig(it.id, { leadTimeDays: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px] pr-12" />
                                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>days</span>
                                                </div>
                                              </label>
                                            </div>
                                          </div>
                                        </div>
                                          );
                                        })()}
                                        {/* Additional UoM-priced tiers — Eli's ask:
                                            same partner, same item, different UoM
                                            can have its own price (e.g. $1.20/Each
                                            but $11/Box because the box rate isn't
                                            12× the each rate). Quantity converts at
                                            order time; price stays independent. */}
                                        {additionalPrices.map((tier, ti) => {
                                          const cardKey = `${it.id}:${ti}`;
                                          const expanded = pricingConfigOpen.has(cardKey);
                                          const patchTier = (patch: Partial<AdditionalPriceTier>) => {
                                            const next = additionalPrices.slice();
                                            next[ti] = { ...next[ti], ...patch };
                                            updateItemConfig(it.id, { additionalPrices: next });
                                          };
                                          return (
                                            <div key={ti} className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                              <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor Sells As</p>
                                                  {/* Set as Primary — same CTA as the
                                                      POC quick-view card, in the same
                                                      slot the Primary pill occupies
                                                      (proximity: state + action live
                                                      in one place). Only moves the
                                                      draft pointer — the card stays
                                                      put; reorder happens on save. */}
                                                  {cfg.primaryTierIndex === ti ? (
                                                    <PrimaryPill className="shrink-0" />
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        updateItemConfig(it.id, { primaryTierIndex: ti });
                                                        toast.success(`${lookupUom(tier.uom || "Each").label} is now the primary selling unit.`);
                                                      }}
                                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                                                      style={{ fontWeight: 500 }}
                                                      aria-label="Set as primary selling unit"
                                                      title="Set as primary selling unit"
                                                    >
                                                      <Star className="w-3 h-3" />
                                                      Set as Primary
                                                    </button>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {(() => {
                                                    const u = lookupUom(tier.uom || "Each");
                                                    return (
                                                      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[#EBF3FF] border border-blue-200 text-[11px] text-primary" style={{ fontWeight: 600 }}>
                                                        {u.label}
                                                        <span className="text-primary/55 text-[10px]" style={{ fontWeight: 500 }}>{u.symbol}</span>
                                                      </span>
                                                    );
                                                  })()}
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const next = additionalPrices.filter((_, j) => j !== ti);
                                                      // Keep the primary pointer aimed at the
                                                      // same card: deleting the primary tier
                                                      // falls back to the base card; tiers
                                                      // after the removed one shift down.
                                                      const pti = cfg.primaryTierIndex;
                                                      const nextPti = pti == null || pti < 0 || pti === ti ? undefined : pti > ti ? pti - 1 : pti;
                                                      updateItemConfig(it.id, { additionalPrices: next, primaryTierIndex: nextPti });
                                                    }}
                                                    className="w-6 h-6 rounded-md text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
                                                    title="Remove this selling unit"
                                                    aria-label="Remove this selling unit"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="p-3 space-y-3">
                                                <div>
                                                  <label className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                    Price per Unit
                                                    <FieldInfo content="The unit price this partner charges for this item, expressed in the chosen unit of measure. The price does NOT convert between pack sizes, each pack carries its own rate. Quantities still convert at PO time." />
                                                  </label>
                                                  <div className="flex items-stretch rounded-lg border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden bg-white">
                                                    <span className="inline-flex items-center justify-center w-9 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border" style={{ fontWeight: 500 }}>$</span>
                                                    <Input
                                                      inputMode="decimal"
                                                      value={tier.price}
                                                      onChange={(e) => patchTier({ price: numericInput(e.target.value, { decimal: true }) })}
                                                      placeholder="0.00"
                                                      className="h-9 text-[13px] border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none flex-1 min-w-0"
                                                    />
                                                    <UomPicker
                                                      variant="embedded"
                                                      value={tier.uom}
                                                      onChange={(v) => patchTier({ uom: v })}
                                                      disabledIds={new Set([cfg.uom, ...additionalPrices.filter((_, j) => j !== ti).map((t) => t.uom)])}
                                                    />
                                                  </div>
                                                </div>
                                                <div className="border-t border-dashed border-[#E2E8F0]" />
                                                <div className="grid grid-cols-3 gap-2">
                                                  <label className="block">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                      Min Order
                                                      <FieldInfo content="Smallest quantity that can be ordered in a single PO line for this pack size. Orders below this are rejected at submit." />
                                                    </span>
                                                    <Input inputMode="numeric" value={tier.minOrderQty ?? ""} onChange={(e) => patchTier({ minOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                  </label>
                                                  <label className="block">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                      Max Order
                                                      <FieldInfo content="Largest quantity that can be ordered in a single PO line. Leave blank for no cap. Useful when the partner can't fulfil oversized requests in one go." />
                                                    </span>
                                                    <Input inputMode="numeric" value={tier.maxOrderQty ?? ""} onChange={(e) => patchTier({ maxOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                  </label>
                                                  <label className="block">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                      Multiples
                                                      <FieldInfo content="Quantities must be a multiple of this number (e.g. 12 = case packs of 12). Set to 1 for any-quantity orders." />
                                                    </span>
                                                    <Input inputMode="numeric" value={tier.multiples ?? ""} onChange={(e) => patchTier({ multiples: numericInput(e.target.value) })} placeholder="1" className="h-9 text-[13px]" />
                                                  </label>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                  <label className="block">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                      Accepted Deviation %
                                                      <FieldInfo content="Allowed over- or under-ship as a % of the ordered quantity. e.g. 5 means shipping within ±5% of the PO is accepted without exception." />
                                                    </span>
                                                    <div className="relative">
                                                      <Input inputMode="decimal" value={tier.acceptedDeviationPct ?? ""} onChange={(e) => patchTier({ acceptedDeviationPct: numericInput(e.target.value, { decimal: true }) })} placeholder="0" className="h-9 text-[13px] pr-7" />
                                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>%</span>
                                                    </div>
                                                  </label>
                                                  <label className="block">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                      Lead Time
                                                      <FieldInfo content="Typical days between order placement and delivery for this pack size from this partner. Drives promise dates and replenishment planning downstream." />
                                                    </span>
                                                    <div className="relative">
                                                      <Input inputMode="numeric" value={tier.leadTimeDays ?? ""} onChange={(e) => patchTier({ leadTimeDays: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px] pr-12" />
                                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>days</span>
                                                    </div>
                                                  </label>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {/* Add another row — picks the next free
                                            UoM, falling back to the full indexable
                                            roster once Defined Alternatives are
                                            exhausted. */}
                                        {(() => {
                                          const usedUoms = new Set([cfg.uom, ...additionalPrices.map((t) => t.uom)]);
                                          const nextUom =
                                            QV_UOM_OPTIONS.find((u) => !usedUoms.has(u.id)) ||
                                            QV_UOM_ALL_INDEXABLE.find((u) => !usedUoms.has(u.id));
                                          /* Locked rows can't add selling units either — every
                                             price on the row is a partner-level value. */
                                          const exhausted = !nextUom || lockedFromPartner;
                                          return (
                                            <button
                                              type="button"
                                              disabled={exhausted}
                                              onClick={() => {
                                                if (!nextUom || lockedFromPartner) return;
                                                updateItemConfig(it.id, { additionalPrices: [...additionalPrices, { price: "", uom: nextUom.id }] });
                                              }}
                                              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] transition-colors ${exhausted ? "border-[#E8ECF1] text-slate-300 cursor-not-allowed" : "border-[#A8D2FF] bg-[#EBF3FF] text-primary hover:bg-[#CFE6FF] cursor-pointer"}`}
                                              style={{ fontWeight: 600 }}
                                              title={lockedFromPartner ? `Selling-unit prices are set on ${_currentPartnerName} and shared by every location.` : exhausted ? "All units of measure have been priced" : "Add a new row for a different UoM."}
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                              Add Another
                                            </button>
                                          );
                                        })()}
                                      </div>
                                      </div>
                                      </InheritedSectionTooltip>
                                    </div>
                                    {/* Standalone Advanced ordering rules section
                                        removed — rules now live INSIDE each price
                                        tier card (per-UoM) per Eli's pass. */}
                                  </div>
                                  </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Section: Freight & Logistics — inheritance
                            from partner defaults + canonical
                            ShippingMethodCarrierCard so the visual
                            matches the partner-detail Freight tab.
                            User can remove inherited cards or stack
                            more via Add Freight. */}
                        {(() => {
                          const open = openSections.has("freight");
                          const inheritedSet = inheritedFreightByItem[it.id] || new Set<string>();
                          // Group selected method ids by carrier so we can
                          // render one card per carrier — same shape as the
                          // partner-detail Freight tab.
                          const methodsByCarrier = new Map<string, string[]>();
                          shippingMethodIds.forEach((methodId) => {
                            for (const c of SHIPPING_CARRIER_CATALOG) {
                              const list = SHIPPING_CARRIER_METHODS[c.id] || [];
                              if (list.some((m) => m.id === methodId)) {
                                const arr = methodsByCarrier.get(c.id) || [];
                                arr.push(methodId);
                                methodsByCarrier.set(c.id, arr);
                                break;
                              }
                            }
                          });
                          return (
                            <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                              <button type="button" onClick={() => toggleSection("freight")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                <div className="flex items-center gap-2.5">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200">
                                    <Truck className="w-3.5 h-3.5 text-[#0E7490]" />
                                  </span>
                                  <div>
                                    <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</p>
                                    <p className="text-[11px] text-slate-500 mt-px">{methodsByCarrier.size === 0 ? "No carriers configured" : `${methodsByCarrier.size} carrier${methodsByCarrier.size === 1 ? "" : "s"} configured`}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {methodsByCarrier.size > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200" style={{ fontWeight: 600 }}>{methodsByCarrier.size}</span>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                                </div>
                              </button>
                              <div
                                aria-hidden={!open}
                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                              >
                                <div className="overflow-hidden">
                                <div className="border-t border-[#EEF2F6] px-4 sm:px-5 py-4 bg-white">
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-[11px] text-slate-500">Pulled from the partner's defaults. Remove or add more as the item needs.</p>
                                    {/* Partner-scoped Add Carrier picker —
                                        lists every active third-party
                                        carrier from the partner's Freight
                                        roster. Each row toggles in / out
                                        of the per-item config; rows
                                        already on the item show a green
                                        Added chip and a single click
                                        removes them again. */}
                                    <Popover
                                      open={addCarrierOpenForItem === it.id}
                                      onOpenChange={(o) => setAddCarrierOpenForItem(o ? it.id : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                                          style={{ fontWeight: 600 }}
                                        >
                                          <Plus className="w-3 h-3" /> Add Carrier
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="end"
                                        sideOffset={8}
                                        className="w-[440px] p-0 z-[260] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.22)] overflow-hidden"
                                      >
                                        {/* Header — soft cyan tint to
                                            match the section's accent
                                            (Freight & Logistics owns
                                            cyan throughout the modal). */}
                                        <div className="px-4 pt-3.5 pb-3 border-b border-[#EEF2F6]" style={{ background: "linear-gradient(180deg, #F0FDFF 0%, #FFFFFF 100%)" }}>
                                          <div className="flex items-start gap-2.5">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-cyan-200 shadow-sm shrink-0">
                                              <Truck className="w-3.5 h-3.5 text-[#0E7490]" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-[13px] text-foreground tracking-[-0.005em]" style={{ fontWeight: 600 }}>Partner-Level Carriers</p>
                                              <p className="text-[11px] text-slate-500 mt-px leading-snug">Carriers configured on this partner's Freight tab. Tap to add or remove for this item.</p>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="max-h-[380px] overflow-y-auto px-2 py-2 space-y-1">
                                          {SHIPPING_CARRIER_CATALOG.filter((c) => c.status === "Active" && !c.isPickup).map((carrier) => {
                                            const carrierMethods = SHIPPING_CARRIER_METHODS[carrier.id] || [];
                                            const primaryMethod = carrierMethods.find((m) => m.isDefault) || carrierMethods[0];
                                            if (!primaryMethod) return null;
                                            const isAdded = shippingMethodIds.includes(primaryMethod.id);
                                            return (
                                              <button
                                                key={carrier.id}
                                                type="button"
                                                onClick={() => {
                                                  if (isAdded) {
                                                    const remaining = shippingMethodIds.filter((mid) => mid !== primaryMethod.id);
                                                    const newDefault = cfg.defaultShippingMethodId === primaryMethod.id ? (remaining[0] || "") : (cfg.defaultShippingMethodId || "");
                                                    updateItemConfig(it.id, { shippingMethodIds: remaining, defaultShippingMethodId: newDefault });
                                                  } else {
                                                    const next = [...shippingMethodIds, primaryMethod.id];
                                                    updateItemConfig(it.id, {
                                                      shippingMethodIds: next,
                                                      defaultShippingMethodId: cfg.defaultShippingMethodId || primaryMethod.id,
                                                    });
                                                  }
                                                }}
                                                className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer ${
                                                  isAdded
                                                    ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50"
                                                    : "bg-white border-transparent hover:bg-[#F7FAFE] hover:border-[#E8ECF1]"
                                                }`}
                                              >
                                                <div
                                                  className="w-9 h-9 rounded-xl border border-[#EEF2F6] flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                                  style={{ backgroundColor: carrier.logoImg ? "#FFFFFF" : `${carrier.color}10` }}
                                                >
                                                  {carrier.logoImg ? (
                                                    <img src={carrier.logoImg} alt={carrier.name} className="w-full h-full object-contain p-0.5" />
                                                  ) : (
                                                    <Truck className="w-4 h-4" style={{ color: carrier.color }} />
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{carrier.name}</p>
                                                  <p className="text-[10px] text-slate-500 truncate mt-px">{primaryMethod.name}</p>
                                                </div>
                                                {isAdded ? (
                                                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-emerald-500 text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" style={{ fontWeight: 600 }}>
                                                    <Check className="w-3 h-3" /> Added
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-white text-primary border border-[#A8D2FF] shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors" style={{ fontWeight: 600 }}>
                                                    <Plus className="w-3 h-3" /> Add
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <div className="px-3.5 py-2.5 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                            <span className="text-foreground" style={{ fontWeight: 600 }}>{shippingMethodIds.length}</span> added
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setAddCarrierOpenForItem(null)}
                                            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] bg-primary text-white hover:bg-[#086AE6] cursor-pointer transition-colors shadow-sm"
                                            style={{ fontWeight: 600 }}
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            Done
                                          </button>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {methodsByCarrier.size === 0 ? (
                                    <div className="rounded-lg border border-dashed border-[#E8ECF1] bg-[#FAFBFC] px-4 py-8 text-center">
                                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No carriers configured</p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">Add a carrier from the partner's Freight tab.</p>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                                      {Array.from(methodsByCarrier.entries()).map(([carrierId, methodIds]) => {
                                        const isInherited = methodIds.some((mid) => inheritedSet.has(mid));
                                        const primaryMethodId = methodIds.includes(cfg.defaultShippingMethodId || "") ? cfg.defaultShippingMethodId! : methodIds[0];
                                        const entry: ShippingCarrierEntry = {
                                          id: carrierId,
                                          carrier: carrierId,
                                          methods: methodIds.join(","),
                                          isDefault: cfg.defaultShippingMethodId === primaryMethodId,
                                          primaryMethod: primaryMethodId,
                                        };
                                        return (
                                          <ShippingMethodCarrierCard
                                            key={carrierId}
                                            entry={entry}
                                            inherited={isInherited}
                                            onEdit={() => toast.info("Editing carrier methods lives on the partner Freight & Logistics tab.")}
                                            onRemove={() => {
                                              const remaining = shippingMethodIds.filter((mid) => !methodIds.includes(mid));
                                              const newDefault = methodIds.includes(cfg.defaultShippingMethodId || "") ? "" : (cfg.defaultShippingMethodId || "");
                                              updateItemConfig(it.id, { shippingMethodIds: remaining, defaultShippingMethodId: newDefault });
                                            }}
                                            onSetPrimary={() => updateItemConfig(it.id, { defaultShippingMethodId: primaryMethodId })}
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Section: Pricing Rules — same inheritance
                            pattern + same compact card visual as the
                            Freight section above, so the two read as a
                            consistent pair. */}
                        {(() => {
                          const open = openSections.has("pricing");
                          const inheritedSet = inheritedPricingByItem[it.id] || new Set<string>();
                          const appliedRules = allPricingRules.filter((r) => appliedRuleIds.includes(r.id));
                          return (
                            <InheritedSectionTooltip active={lockedFromPartner} partnerName={_currentPartnerName}>
                            <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                              <button type="button" onClick={() => toggleSection("pricing")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                <div className="flex items-center gap-2.5">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 border border-violet-200">
                                    <ChartColumn className="w-3.5 h-3.5 text-violet-700" />
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing Rules</p>
                                      {lockedFromPartner && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9.5px] border bg-white text-slate-500 border-slate-200"
                                          style={{ fontWeight: 600 }}
                                        >
                                          <Lock className="w-2.5 h-2.5" />
                                          Set at Partner
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-px">{appliedRules.length === 0 ? "No rules applied" : `${appliedRules.length} rule${appliedRules.length === 1 ? "" : "s"} applied`}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {appliedRules.length > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-violet-50 text-violet-800 border border-violet-200" style={{ fontWeight: 600 }}>{appliedRules.length}</span>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                                </div>
                              </button>
                              <div
                                aria-hidden={!open}
                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                              >
                                <div className="overflow-hidden">
                                {/* Content grays out wholesale in location scope
                                    when the item is already qualified with the
                                    partner — pricing rules are partner-level.
                                    The collapse header above stays clickable so
                                    the user can still inspect the rules. */}
                                <div className={`border-t border-[#EEF2F6] px-4 sm:px-5 py-4 ${lockedFromPartner ? "bg-[#FAFBFC] opacity-60 pointer-events-none select-none" : "bg-white"}`} aria-disabled={lockedFromPartner || undefined}>
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-[11px] text-slate-500">{lockedFromPartner ? "Inherited from the partner and shared by every location." : "Pulled from the partner's defaults. Remove or add more as the item needs."}</p>
                                    {/* Partner-scoped Add Rule picker —
                                        lists the pricing rules configured
                                        on the partner. Each row toggles
                                        in / out of the per-item config;
                                        already-applied rows show a green
                                        Added chip and a single click
                                        removes them. */}
                                    <Popover
                                      open={addRuleOpenForItem === it.id}
                                      onOpenChange={(o) => setAddRuleOpenForItem(o ? it.id : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                                          style={{ fontWeight: 600 }}
                                        >
                                          <Plus className="w-3 h-3" /> Add Rule
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="end"
                                        sideOffset={8}
                                        className="w-[440px] p-0 z-[260] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.22)] overflow-hidden"
                                      >
                                        {/* Header — soft violet tint to
                                            match the section's accent
                                            (Pricing Rules owns violet
                                            throughout the modal). */}
                                        <div className="px-4 pt-3.5 pb-3 border-b border-[#EEF2F6]" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)" }}>
                                          <div className="flex items-start gap-2.5">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-violet-200 shadow-sm shrink-0">
                                              <ChartColumn className="w-3.5 h-3.5 text-violet-700" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-[13px] text-foreground tracking-[-0.005em]" style={{ fontWeight: 600 }}>Partner-Level Pricing Rules</p>
                                              <p className="text-[11px] text-slate-500 mt-px leading-snug">Rules set on this partner's Pricing Rules tab. Tap to add or remove for this item.</p>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="max-h-[380px] overflow-y-auto px-2 py-2 space-y-1">
                                          {allPricingRules.map((rule) => {
                                            const isAdded = appliedRuleIds.includes(rule.id);
                                            const isDiscount = rule.type === "discount";
                                            const pill = isDiscount
                                              ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                                              : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
                                            return (
                                              <button
                                                key={rule.id}
                                                type="button"
                                                onClick={() => {
                                                  if (isAdded) {
                                                    const next = appliedRuleIds.filter((id) => id !== rule.id);
                                                    updateItemConfig(it.id, { appliedPricingRuleIds: next });
                                                  } else {
                                                    updateItemConfig(it.id, { appliedPricingRuleIds: [...appliedRuleIds, rule.id] });
                                                  }
                                                }}
                                                className={`group w-full flex items-start gap-3 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer ${
                                                  isAdded
                                                    ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50"
                                                    : "bg-white border-transparent hover:bg-[#F7FAFE] hover:border-[#E8ECF1]"
                                                }`}
                                              >
                                                <span
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] border shrink-0 mt-0.5"
                                                  style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}
                                                >
                                                  {isDiscount ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                                                  {isDiscount ? "Discount" : "Premium"}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{rule.label}</p>
                                                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-px">{rule.subtitle}</p>
                                                </div>
                                                {isAdded ? (
                                                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-emerald-500 text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)] mt-0.5" style={{ fontWeight: 600 }}>
                                                    <Check className="w-3 h-3" /> Added
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-white text-primary border border-[#A8D2FF] shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors mt-0.5" style={{ fontWeight: 600 }}>
                                                    <Plus className="w-3 h-3" /> Add
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <div className="px-3.5 py-2.5 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                          {/* Quick-create entry — opens the simple
                                              partner-scoped rule form with this item
                                              preselected. */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setAddRuleOpenForItem(null);
                                              setNewRuleName("");
                                              setNewRuleType("discount");
                                              setNewRuleValue("");
                                              setCreateRuleForItem(it);
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                                            style={{ fontWeight: 600 }}
                                          >
                                            <Plus className="w-3 h-3" /> Create New Rule
                                          </button>
                                          <div className="flex items-center gap-2.5">
                                            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                              <span className="text-foreground" style={{ fontWeight: 600 }}>{appliedRuleIds.length}</span> added
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setAddRuleOpenForItem(null)}
                                              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] bg-primary text-white hover:bg-[#086AE6] cursor-pointer transition-colors shadow-sm"
                                              style={{ fontWeight: 600 }}
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              Done
                                            </button>
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {appliedRules.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-[#E8ECF1] bg-[#FAFBFC] px-4 py-8 text-center">
                                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No pricing rules applied</p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">Add a rule from the partner's Pricing Rules tab, or</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewRuleName("");
                                          setNewRuleType("discount");
                                          setNewRuleValue("");
                                          setCreateRuleForItem(it);
                                        }}
                                        className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary hover:underline cursor-pointer"
                                        style={{ fontWeight: 600 }}
                                      >
                                        <Plus className="w-3 h-3" /> Create New Rule
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                                      {appliedRules.map((rule) => {
                                        const isInherited = inheritedSet.has(rule.id);
                                        const isDiscount = rule.type === "discount";
                                        const pill = isDiscount
                                          ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5", iconBg: "#ECFDF5", iconBorder: "#A7F3D0", iconColor: "#065F46" }
                                          : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE", iconBg: "#F5F3FF", iconBorder: "#DDD6FE", iconColor: "#5B21B6" };
                                        return (
                                          <div
                                            key={rule.id}
                                            className="bg-white border border-border rounded-xl group transition-all duration-200 flex flex-col relative h-full"
                                          >
                                            <div className="p-3 flex-1 flex flex-col min-h-0">
                                              {/* Row 1: Type/Inherited chips + status */}
                                              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] border" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}>
                                                    {isDiscount ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                                    {isDiscount ? "Discount" : "Premium"}
                                                  </span>
                                                  {isInherited && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF] whitespace-nowrap" style={{ fontWeight: 600 }} title="Inherited from partner default">
                                                      <Check className="w-2.5 h-2.5" /> Inherited
                                                    </span>
                                                  )}
                                                  {rule.custom && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EBF3FF] text-[#094D9F] border-[#CFE6FF] whitespace-nowrap" style={{ fontWeight: 600 }} title="Scoped to this partner only, other partners are not affected">
                                                      <Layers className="w-2.5 h-2.5" /> Partner-Scoped
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontWeight: 500 }}>Active</span>
                                              </div>
                                              {/* Row 2: rule name */}
                                              <p className="text-[13px] text-slate-700 truncate mb-1" style={{ fontWeight: 600 }}>{rule.label}</p>
                                              {/* Row 3: subtitle */}
                                              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{rule.subtitle}</p>
                                              {/* Footer strip */}
                                              <div className="mt-auto pt-2.5">
                                                <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px]">
                                                  <span className="inline-flex items-center gap-1 text-slate-500">
                                                    <Sparkles className="w-3 h-3 text-slate-400" />
                                                    <span style={{ fontWeight: 500 }}>{rule.custom ? "Partner-Scoped Rule" : "Rule Preset"}</span>
                                                  </span>
                                                  <span className="text-slate-400">·</span>
                                                  <span className="text-slate-500" style={{ fontWeight: 500 }}>Auto-Applied</span>
                                                </div>
                                              </div>
                                            </div>
                                            {/* Hover-only actions — Edit routes through the
                                                shared-rule warning (the rule is used by other
                                                partners); Remove always confirms first since
                                                it detaches the rule from the whole partner. */}
                                            <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (rule.custom) {
                                                    // Partner-scoped rule — no other partners affected, so no warning gate.
                                                    toast.info(`"${rule.label}" is scoped to ${_currentPartnerName} only, rule editor coming soon`);
                                                  } else {
                                                    setPendingRuleEdit({ itemId: it.id, rule });
                                                  }
                                                }}
                                                className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-blue-50 transition-all flex items-center justify-center cursor-pointer"
                                                title="Edit Rule"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setPendingRuleRemove({ itemId: it.id, rule })}
                                                className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-all flex items-center justify-center cursor-pointer"
                                                title="Remove rule from this partner"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                </div>
                              </div>
                            </div>
                            </InheritedSectionTooltip>
                          );
                        })()}
                      </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Footer — actions. Layout mirrors CreatePartnerModal: soft
            text-link Back on the left (mr-auto), Cancel + primary CTA
            cluster on the right. Status counts ("X selected", "X ready
            to configure") sit between Back and Cancel as a quiet
            metadata line — they stay visible without competing with
            the action cluster. */}
        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
          {view === "configure" && !editMode && (
            <button
              onClick={() => setView("browse")}
              className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto"
              style={{ fontWeight: 500 }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div className={`flex items-center gap-2 text-[12px] text-slate-500 ${view === "configure" && !editMode ? "" : "mr-auto"}`}>
            {/* Browse footer shows ONLY the current selection against the
                list total — stakeholder ask: no roster counts or
                ready-to-configure phrasing. */}
            {editMode ? (
              <span style={{ fontWeight: 500 }}>Editing qualified-vendor configuration</span>
            ) : view === "configure" ? (
              <span style={{ fontWeight: 500 }}>{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} to configure</span>
            ) : view === "browse" ? (
              selectedIds.size > 0 && (
                <span className="text-slate-500" style={{ fontWeight: 400 }}>
                  <span className="text-foreground" style={{ fontWeight: 500 }}>{selectedIds.size}</span>
                  {" "}item{selectedIds.size !== 1 ? "s" : ""} selected out of{" "}
                  <span className="text-foreground" style={{ fontWeight: 500 }}>{available.length}</span>
                  {" "}total items
                </span>
              )
            ) : (
              <>
                <span style={{ fontWeight: 500 }}>
                  {`${existingItems.length} ${generic
                    ? "items added"
                    : activeSubTab === "sell"
                      ? "qualified-vendor items added"
                      : "approved-buyer items added"}`}
                </span>
                {addedSelectedIds.size > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-destructive" style={{ fontWeight: 600 }}>{addedSelectedIds.size} selected</span>
                  </>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseIntent}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {view === "added" && addedSelectedIds.size > 0 && (
            <Button
              onClick={() => setBulkRemoveConfirmOpen(true)}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-destructive text-white hover:bg-[#B91C1C] shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
            </Button>
          )}
          {view === "added" && addedSelectedIds.size === 0 && (
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#086AE6] shadow-sm"
            >
              Done
            </Button>
          )}
          {view === "browse" && (
            <Button
              onClick={handleAdd}
              disabled={selectedIds.size === 0}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#086AE6] shadow-sm disabled:opacity-50"
            >
              {/* Sell sub-tab steps into the Configure view to capture
                  pricing + ordering params; everywhere else commits
                  directly. */}
              {activeSubTab === "sell" && !generic ? (
                <>
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  {generic
                    ? `Add ${selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}` : "Items"}`
                    : `Add ${selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}` : "Items"} ${addCtaSuffix}`}
                </>
              )}
            </Button>
          )}
          {view === "configure" && (
            <Button
              onClick={handleSaveConfigured}
              disabled={selectedIds.size === 0}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#086AE6] shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {editMode
                ? "Save Changes"
                : `Add ${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""} as Qualified Vendor`}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Per-row remove confirmation — same destructive-red treatment
          as the bulk modal, scaled down to a single-item prompt. */}
      <AlertDialog open={!!pendingSingleRemoveId} onOpenChange={(o) => { if (!o) setPendingSingleRemoveId(null); }}>
        <AlertDialogContent
          className={`sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          onInteractOutside={() => setPendingSingleRemoveId(null)}
        >
          {(() => {
            const removedItem = pendingSingleRemoveId ? existingItems.find((it) => it.id === pendingSingleRemoveId) : null;
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <Trash2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
                    Remove Item
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                      {removedItem ? `Remove ${removedItem.partNo}?` : "Remove this item?"}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription asChild>
                    <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                      <p>{removedItem?.description || "This item will be removed from the list. You can add it back later from Browse Inventory."}</p>
                    </div>
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction
                      onClick={handleSingleRemoveConfirm}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                    >
                      Remove Item
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      Keep Item
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk remove confirmation — gradient style */}
      <AlertDialog open={bulkRemoveConfirmOpen} onOpenChange={setBulkRemoveConfirmOpen}>
        <AlertDialogContent
          className={`sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          onInteractOutside={() => setBulkRemoveConfirmOpen(false)}
        >
          {/* Gradient header */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Remove Items
            </span>
          </div>
          {/* Content */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Remove {addedSelectedIds.size} item{addedSelectedIds.size !== 1 ? "s" : ""}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                <p>The following items will be removed. You can add them back later.</p>
                {/* Items list */}
                <div className="mt-3 max-h-[120px] overflow-y-auto text-left rounded-lg border border-border bg-slate-50">
                  {Array.from(addedSelectedIds).slice(0, 10).map((id) => {
                    const item = existingItems.find((it) => it.id === id);
                    return item ? (
                      <div key={id} className="flex items-center gap-2 px-3 py-1.5 border-b border-muted last:border-0">
                        <Package className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{item.partNo}</span>
                        <span className="text-[11px] text-slate-500 truncate">{item.description}</span>
                      </div>
                    ) : null;
                  })}
                  {addedSelectedIds.size > 10 && (
                    <div className="px-3 py-1.5 text-[11px] text-slate-400 text-center" style={{ fontWeight: 500 }}>
                      +{addedSelectedIds.size - 10} more items
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleBulkRemove}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit warning — fires when the user tries to close with
          unsaved work (any selected browse rows, any per-item Configure
          draft, or while sitting on the Configure step). Canonical
          destructive treatment, matched to the CreatePartnerModal
          discard dialog so the discard semantics read identically
          across the module. */}
      <AlertDialog open={exitWarnOpen} onOpenChange={setExitWarnOpen}>
        <AlertDialogContent
          className={`sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          style={{ zIndex: generic ? 240 : 220 }}
          onInteractOutside={() => setExitWarnOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Discard changes?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                <p>
                  {(selectedIds.size > 0 || Object.keys(configById).length > 0) && (
                    <>
                      {selectedIds.size > 0 && `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected`}
                      {selectedIds.size > 0 && Object.keys(configById).length > 0 && " · "}
                      {Object.keys(configById).length > 0 && `${Object.keys(configById).length} pricing draft${Object.keys(configById).length !== 1 ? "s" : ""}`}
                      {". "}
                    </>
                  )}
                  All unsaved changes will be lost. This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={discardAndClose}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Discard Changes
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Continue Editing
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shared-rule edit warning — editing a pricing rule from the
          qualification flow touches every partner on the current
          version, so the prompt lists the affected partners and offers
          the safe alternative: a partner-scoped copy that replaces the
          shared rule here without touching anyone else. Amber tone =
          caution, not destruction. */}
      <AlertDialog open={!!pendingRuleEdit} onOpenChange={(o) => { if (!o) setPendingRuleEdit(null); }}>
        <AlertDialogContent
          className={`sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          style={{ zIndex: generic ? 240 : 220 }}
          onInteractOutside={(e) => {
            // Interactions with the partner quick-view (portaled above this
            // dialog) shouldn't dismiss the warning underneath it.
            if (quickViewData) { e.preventDefault(); return; }
            setPendingRuleEdit(null);
          }}
        >
          <div className="relative flex flex-col items-center pt-8 pb-5" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <Pencil className="w-7 h-7" style={{ color: "#B45309" }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}>
              Shared Rule
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[17px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {`Edit "${pendingRuleEdit?.rule.label ?? "this pricing rule"}"?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              This pricing rule is shared. Editing it here updates it for <span style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>every partner using the current version</span>, not just {_currentPartnerName}.
            </AlertDialogDescription>
            {/* Affected partners — who else is on this version */}
            <div className="w-full mt-4 rounded-xl border border-border bg-white text-left overflow-hidden">
              <div className="px-3.5 py-2 border-b border-border bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Partners Using This Version</span>
                <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200" style={{ fontWeight: 600 }}>{affectedPartnersForRule.length}</span>
              </div>
              <div className="max-h-[168px] overflow-y-auto divide-y divide-border/60">
                {affectedPartnersForRule.map((p) => {
                  const pName = p.displayName || p.companyName;
                  const initials = pName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const pTypes = p.partnerTypes || [];
                  // The partner's amounts are in its own currency.
                  const fmtMoney = (n: number) => formatCompactMoney(n, partnerCurrencyOf(p));
                  const openPartner = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    window.open(`/vendors/${p.id}`, "_blank", "noopener");
                  };
                  const openQuickView = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setQuickViewData({
                      type: "partner",
                      item: {
                        id: p.id,
                        name: pName,
                        subtitle: p.code || "Partner",
                        meta: {
                          types: pTypes,
                          status: p.status,
                          code: p.code,
                          country: p.country,
                          email: p.emailAddress,
                          website: p.website,
                          creditLimit: p.creditLimit,
                          totalSpent: p.totalSpent,
                          locations: (p.partnerLocations || []).length,
                        },
                      },
                      vendorName: pName,
                      vendorId: p.id,
                    });
                  };
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 px-3.5 py-2">
                      {/* Avatar — hover shows the partner business card,
                          click opens the canonical partner quick view. */}
                      <HoverCard openDelay={200} closeDelay={80}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={openQuickView}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 border border-border text-[9px] text-slate-600 shrink-0 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                            style={{ fontWeight: 600 }}
                          >
                            {initials}
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="bottom"
                          align="start"
                          className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                            <div className="flex items-center gap-3 relative">
                              <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[12px] text-white shrink-0" style={{ fontWeight: 700 }}>
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{pName}</p>
                                <p className="text-[11px] text-slate-400 truncate">{pTypes.map((t) => (t === "vendor" ? "Vendor" : "Customer")).join(" · ") || "Partner"}{p.code ? ` · ${p.code}` : ""}</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white px-4 py-3 space-y-2">
                            {p.emailAddress && (
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{p.emailAddress}</span></div>
                            )}
                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{p.country || "—"}</span></div>
                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{fmtMoney(p.creditLimit || 0)} credit · {fmtMoney(p.totalSpent || 0)} spent</span></div>
                            <button
                              type="button"
                              onClick={openPartner}
                              className="mt-2 inline-flex items-center justify-center w-full gap-1.5 h-8 rounded-md bg-primary text-white text-[12px] hover:bg-[#086AE6] transition-colors cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Go to Partner
                            </button>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                      {/* Name — underline on hover, opens the partner detail page in a new tab. */}
                      <span
                        className="text-[12px] text-slate-700 truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                        style={{ fontWeight: 500 }}
                        onClick={openPartner}
                      >
                        {pName}
                      </span>
                      {/* Trade-direction pills — the relevant context for a
                          pricing-rule audience (replaces the partner code). */}
                      <div className="ml-auto flex items-center gap-1 shrink-0">
                        {pTypes.length > 0 ? pTypes.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] border"
                            style={{
                              fontWeight: 600,
                              backgroundColor: t === "vendor" ? "#EBF3FF" : "#F5F3FF",
                              color: t === "vendor" ? "#0548A3" : "#5B21B6",
                              borderColor: t === "vendor" ? "#A8D2FF" : "#DDD6FE",
                            }}
                          >
                            {t === "vendor" ? "Vendor" : "Customer"}
                          </span>
                        )) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-full mt-5 flex flex-col gap-2.5">
              {/* Safe path — partner-scoped copy */}
              <button
                onClick={handleCreateRuleCopy}
                className="w-full rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] px-4 py-3 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-primary/30 shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" style={{ color: "rgb(var(--primary))" }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px]" style={{ fontWeight: 600, color: "rgb(var(--primary))" }}>
                      Create a Copy for This Partner
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-primary/10 align-middle" style={{ fontWeight: 600, color: "rgb(var(--primary))" }}>Recommended</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Saves a partner-scoped copy that replaces the shared rule on {_currentPartnerName}. Other partners keep the original.</p>
                  </div>
                </div>
              </button>
              {/* Risky path — edit the shared rule everywhere */}
              <button
                onClick={handleEditRuleForAll}
                className="w-full rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 px-4 py-3 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-amber-200 shrink-0 mt-0.5">
                    <Pencil className="w-4 h-4" style={{ color: "#B45309" }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px]" style={{ fontWeight: 600, color: "#92400E" }}>Edit for All Partners</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Updates the shared rule everywhere, all {affectedPartnersForRule.length} partner{affectedPartnersForRule.length !== 1 ? "s" : ""} listed above will see the change.</p>
                  </div>
                </div>
              </button>
              <AlertDialogCancel
                className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove-rule confirmation — the remove icon detaches the rule
          from this partner altogether (every item), so it always asks
          first. Canonical destructive treatment. */}
      <AlertDialog open={!!pendingRuleRemove} onOpenChange={(o) => { if (!o) setPendingRuleRemove(null); }}>
        <AlertDialogContent
          className={`sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          style={{ zIndex: generic ? 240 : 220 }}
          onInteractOutside={() => setPendingRuleRemove(null)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Remove Rule
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {`Remove "${pendingRuleRemove?.rule.label ?? "this pricing rule"}" from ${_currentPartnerName}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              This removes the pricing rule from {_currentPartnerName} <span style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>altogether, it stops applying to all items</span>, not just this one. The rule itself isn't deleted and stays available to other partners. Are you sure you want to continue?
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleRemoveRuleFromPartner}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Remove Rule
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Rule
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create New Rule — simple partner-scoped quick-create with the
          launching item preselected. Violet accent = Pricing Rules. */}
      <Dialog open={!!createRuleForItem} onOpenChange={(o) => { if (!o) setCreateRuleForItem(null); }}>
        <DialogContent
          className="sm:max-w-[460px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: generic ? 240 : 220 }}
        >
          <div className="px-6 pt-5 pb-4 border-b border-[#EEF2F6]" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)" }}>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-violet-200 shadow-sm shrink-0">
                <ChartColumn className="w-4 h-4 text-violet-700" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] tracking-[-0.01em]" style={{ fontWeight: 600 }}>Create Pricing Rule</DialogTitle>
                <DialogDescription className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  A simple rule scoped to {_currentPartnerName}, other partners are not affected.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] text-slate-600 block mb-1.5" style={{ fontWeight: 600 }}>Rule name</label>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="e.g. Spring Promo Discount"
                className="h-9 text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1.5" style={{ fontWeight: 600 }}>Type</label>
                <div className="inline-flex w-full items-center rounded-lg bg-slate-50 border border-border/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setNewRuleType("discount")}
                    className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${newRuleType === "discount" ? "shadow-sm" : "hover:bg-white/60"}`}
                    style={{ fontWeight: newRuleType === "discount" ? 600 : 500, color: newRuleType === "discount" ? "#047857" : "#334155", backgroundColor: newRuleType === "discount" ? "#ECFDF5" : undefined }}
                  >
                    <TrendingDown className="w-3 h-3" /> Discount
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleType("premium")}
                    className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${newRuleType === "premium" ? "shadow-sm" : "hover:bg-white/60"}`}
                    style={{ fontWeight: newRuleType === "premium" ? 600 : 500, color: newRuleType === "premium" ? "#6D28D9" : "#334155", backgroundColor: newRuleType === "premium" ? "#F5F3FF" : undefined }}
                  >
                    <TrendingUp className="w-3 h-3" /> Premium
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1.5" style={{ fontWeight: 600 }}>{newRuleType === "discount" ? "Discount" : "Markup"} value</label>
                <div className="relative">
                  <Input
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="e.g. 5"
                    inputMode="decimal"
                    className="h-9 text-[13px] pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 600 }}>%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1.5" style={{ fontWeight: 600 }}>Applies to</label>
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-emerald-200 shrink-0">
                  <Package className="w-3.5 h-3.5 text-emerald-700" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{createRuleForItem?.partNo}</p>
                  <p className="text-[10px] text-slate-500 truncate">{createRuleForItem?.description}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white shrink-0" style={{ fontWeight: 600 }}>
                  <Check className="w-2.5 h-2.5" /> Pre-Selected
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">The item you launched from is preselected. More items can be added after creation.</p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateRuleForItem(null)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer px-4 h-9"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateNewRule}
              disabled={!newRuleName.trim() || !newRuleValue.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 h-9 text-[13px] bg-primary text-white hover:bg-[#086AE6] cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create &amp; Apply
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>

    {/* Item / partner quick-view — same shared component the main Items
        tab uses. Portal-rendered; raised above the shared-rule edit
        warning (z 220 / 240 when generic) so partner cards opened from
        that dialog layer correctly. */}
    <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} zIndex={260} />

    {/* Canonical Create/Duplicate Pricing Rule modal — the embedded
        create-only PricingRulesTab instance. Copy mode prefills the
        form with " (Copy)" in the title (same as the Pricing Rules
        tab's duplicate flow); edit mode prefills the rule as-is. */}
    {ruleFormSession && _currentPartner && (
      <PricingRulesTabNew
        vendor={_currentPartner}
        embeddedCreateOnly
        embeddedCreatePrefill={{
          name: ruleFormSession.mode === "copy" ? `${ruleFormSession.rule.label} (Copy)` : ruleFormSession.rule.label,
          description: ruleFormSession.rule.subtitle,
          category: ruleFormSession.rule.type,
          mode: ruleFormSession.mode,
        }}
        onEmbeddedCreateClose={() => setRuleFormSession(null)}
        onEmbeddedCreateSaved={handleRuleFormSaved}
      />
    )}
    </>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

type SubTab = "sell" | "purchase" | "transactions";
/* Direction filter inside the Transactions sub-tab — Irtaza's concept:
 * one view that surfaces "what we bought from them" + "what they bought
 * from us" + "what came back" in one place. Defaults to Purchased
 * (the only direction with real data this push). Sold and Returns
 * render "coming soon" placeholders until their feeds land. The bucket
 * list is designed to expand — add new types here and the sub-tab
 * strip below picks them up automatically. */
type TransactionDirection = "purchased" | "sold" | "returns";
type Density = "condensed" | "comfort" | "card";
type ItemFilter = "all" | "Active" | "Inactive" | "Serialized" | "Non-Serialized" | "Lot Controlled";

const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

/* Purchase History — read-only ledger sourced from the deterministic
 * seed (getPurchaseHistoryForPartner). Rendered as a dedicated table
 * when the user picks the Purchase History sub-tab. Columns:
 *   Item · Last bought · Total qty · Total spend · PO count · Last PO
 * Click a row to surface the line-by-line PO history in a future
 * detail panel; for now the row is non-navigational. */
/* Purchase History time-window options — the "when" dimension Eli /
 * Nophil called out. Defaults to 90 days to keep the table focused on
 * recent ordering patterns; "All time" stays one click away. */
export type PurchaseHistoryRange = "30d" | "90d" | "1y" | "all";
export const PURCHASE_HISTORY_RANGE_OPTIONS: { key: PurchaseHistoryRange; label: string; days: number | null }[] = [
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "1y", label: "Last Year", days: 365 },
  { key: "all", label: "All Time", days: null },
];

function filterPurchaseHistory(rows: PurchaseHistoryRow[], rangeDays: number | null, search: string, cancelledOnly = false): PurchaseHistoryRow[] {
  const cutoff = rangeDays !== null ? Date.now() - rangeDays * 86400000 : null;
  const q = search.trim().toLowerCase();
  return rows
    .map((r): PurchaseHistoryRow | null => {
      // Trim PO lines to the window (and to cancelled lines when the
      // Cancelled quick filter is on). If nothing remains, drop the row.
      let linesInRange = cutoff === null ? r.lines : r.lines.filter((l) => new Date(l.date).getTime() >= cutoff);
      if (cancelledOnly) linesInRange = linesInRange.filter((l) => l.cancelled);
      if (linesInRange.length === 0) return null;
      if (q && !(r.item.partNo.toLowerCase().includes(q) || r.item.description.toLowerCase().includes(q))) return null;
      // Re-aggregate when the window narrowed.
      if (linesInRange.length === r.lines.length) return r;
      const totalQty = linesInRange.reduce((s, l) => s + l.qty, 0);
      const totalSpend = Number(linesInRange.reduce((s, l) => s + l.totalSpend, 0).toFixed(2));
      const last = linesInRange[0];
      return {
        item: r.item,
        totalQty,
        totalSpend,
        poCount: linesInRange.length,
        lastDate: last.date,
        lastPoNumber: last.poNumber,
        lines: linesInRange,
      };
    })
    .filter((r): r is PurchaseHistoryRow => !!r)
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

/* Build the deep-link URL + the QuickViewPanel payload for a partner-
 * item row. Centralised so the Transactions table, the Top-Item KPI,
 * and any future item-deep-link surface stay in sync with the canonical
 * pattern used elsewhere in PartnerItemsTab. */
function buildItemQuickViewPayload(item: PartnerItemData, vendorName: string): { url: string; payload: QuickViewData } {
  const trail = item.id.split("-").pop();
  const numericId = trail && /^\d+$/.test(trail) ? String(parseInt(trail, 10) + 1) : "1";
  const url = `https://nimble-palette.lovable.app/items/${numericId}`;
  return {
    url,
    payload: {
      type: "item",
      item: {
        id: numericId,
        name: item.partNo,
        subtitle: item.category,
        imageUrl: item.image,
      },
      vendorName,
      navUrlOverride: url,
      navLabelOverride: "Go to Item",
    },
  };
}

function PurchaseHistoryView({ rows, vendorName, onItemQuickView, visibleColumns, direction = "purchased" }: { rows: PurchaseHistoryRow[]; vendorName: string; onItemQuickView: (data: QuickViewData) => void; /** Ordered list of column keys to render. Defaults to the full set when omitted. */ visibleColumns?: string[]; /** Transaction direction — flips column labels + the deep-link
   *  pattern between PO (purchases) and SO (sales). The row shape is
   *  identical in both directions so the table stays one component. */
  direction?: "purchased" | "sold" }) {
  const isSales = direction === "sold";
  const cols = visibleColumns && visibleColumns.length > 0 ? visibleColumns : DEFAULT_TRANSACTION_COLUMN_ORDER;
  // Flatten the per-item rows into a per-transaction ledger: one entry per
  // receipt (purchasing) / shipment (selling) line. A partial receipt against
  // one PO is its own line, so the same item can appear in multiple rows.
  // Sorted most-recent-first.
  const transactions = useMemo(
    () => rows
      .flatMap((r) => r.lines.map((line) => ({ item: r.item, line })))
      .sort((a, b) => (a.line.date < b.line.date ? 1 : -1)),
    [rows],
  );
  // Local pagination — table size scales with the partner's transaction volume.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  // Reset to page 1 whenever the upstream filter changes.
  useEffect(() => { setPage(1); }, [transactions.length]);
  // "All" is represented by perPage === -1.
  const effectivePerPage = perPage === -1 ? Math.max(1, transactions.length) : perPage;
  const totalPages = Math.max(1, Math.ceil(transactions.length / effectivePerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = transactions.slice((safePage - 1) * effectivePerPage, safePage * effectivePerPage);
  const pageNumbers = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const arr: (number | "...")[] = [1];
    if (safePage > 3) arr.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) arr.push(i);
    if (safePage < totalPages - 2) arr.push("...");
    arr.push(totalPages);
    return arr;
  }, [safePage, totalPages]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <Table style={{ tableLayout: "fixed", minWidth: 1360 }}>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
              {cols.map((key) => {
                const meta: Record<string, { label: string; width: number; align?: "right" }> = {
                  item: { label: "Item", width: 280 },
                  date: { label: isSales ? "Date Shipped" : "Date Received", width: 130 },
                  qty: { label: isSales ? "Quantity Shipped" : "Quantity Received", width: 140, align: "right" },
                  po_unit: { label: isSales ? "Shipping Unit of Measure" : "Receiving Unit of Measure", width: 170 },
                  base_uom: { label: "Base Unit of Measure", width: 150 },
                  unit_price: { label: "Unit Price", width: 110, align: "right" },
                  value: { label: "Value", width: 130, align: "right" },
                  order: { label: isSales ? "SO" : "PO", width: 130 },
                };
                const m = meta[key];
                if (!m) return null;
                return (
                  <TableHead
                    key={key}
                    className={`text-[11px] text-slate-500 !pl-4${m.align === "right" ? " text-right" : ""}`}
                    style={{ fontWeight: 500, width: m.width }}
                  >
                    {m.label}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Receipt className="w-6 h-6 text-slate-300" />
                    <p className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>{isSales ? "No sales history in the selected window" : "No purchase history in the selected window"}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ item, line }) => {
                /* PO / SO deep-link — rotate across three demo URLs
                   based on a stable hash of the order number so the
                   same row always opens the same link. Replace with the
                   real PO / SO module route when this ships out of
                   demo data. Sales uses the same demo space until the
                   sales-order detail module ships. */
                const PO_DEMO_URLS = [
                  "https://pleasant-flow.lovable.app/purchase-orders/po-demo-draft",
                  "https://pleasant-flow.lovable.app/purchase-orders/po-10",
                  "https://pleasant-flow.lovable.app/purchase-orders/po-2",
                ];
                const SO_DEMO_URLS = [
                  "https://pleasant-flow.lovable.app/sales-orders/so-demo-draft",
                  "https://pleasant-flow.lovable.app/sales-orders/so-10",
                  "https://pleasant-flow.lovable.app/sales-orders/so-2",
                ];
                const orderUrls = isSales ? SO_DEMO_URLS : PO_DEMO_URLS;
                const orderUrl = orderUrls[hashStringForRestriction(line.poNumber) % orderUrls.length];
                const { url: itemUrl, payload: quickViewPayload } = buildItemQuickViewPayload(item, vendorName);
                const receivingUom = receivingUomForItem(item.id);
                const cellMap: Record<string, React.ReactNode> = {
                  item: (
                    <TableCell key="item">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <HoverCard openDelay={250} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onItemQuickView(quickViewPayload); }}
                              className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                              title="View Item Details"
                            >
                              <img src={item.image} alt="" className="w-full h-full object-cover" />
                            </button>
                          </HoverCardTrigger>
                          <ItemHoverCardContent
                            image={item.image}
                            partNo={item.partNo}
                            category={item.category}
                            manufacturer={item.manufacturer}
                            description={item.description}
                            inventoryControl={item.itemControlType}
                            onHand={item.onHand}
                            onHandUnit={item.onHandUnit}
                            status={item.status}
                            preferredAcquisition={item.preferredAcquisition}
                          />
                        </HoverCard>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.open(itemUrl, "_blank", "noopener,noreferrer"); }}
                            className="text-[12px] text-slate-800 truncate block text-left cursor-pointer hover:text-primary hover:underline transition-colors w-full"
                            style={{ fontWeight: 500 }}
                            title="Open item detail in a new tab"
                          >
                            {item.partNo}
                          </button>
                          <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                        </div>
                      </div>
                    </TableCell>
                  ),
                  date: (
                    <TableCell key="date"><span className="text-sm text-slate-700 whitespace-nowrap">{new Date(line.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span></TableCell>
                  ),
                  qty: (
                    <TableCell key="qty" className="text-right"><span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{line.qty.toLocaleString()}</span></TableCell>
                  ),
                  po_unit: (
                    <TableCell key="po_unit">
                      <span className="text-sm text-slate-700 whitespace-nowrap">
                        {receivingUom}
                        {(UOM_PACK_SIZE[receivingUom] ?? 1) > 1 && (
                          <span className="text-[11px] text-slate-400"> ({UOM_PACK_SIZE[receivingUom]} ea)</span>
                        )}
                      </span>
                    </TableCell>
                  ),
                  base_uom: (
                    <TableCell key="base_uom"><span className="text-sm text-slate-700 whitespace-nowrap">Each</span></TableCell>
                  ),
                  unit_price: (
                    <TableCell key="unit_price" className="text-right"><span className="text-sm text-slate-700">${line.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell>
                  ),
                  value: (
                    <TableCell key="value" className="text-right"><span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>${line.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell>
                  ),
                  order: (
                    <TableCell key="order">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <a
                          href={orderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-700 whitespace-nowrap hover:text-primary hover:underline transition-colors cursor-pointer"
                          title={isSales ? "Open SO in a new tab" : "Open PO in a new tab"}
                        >
                          {line.poNumber}
                        </a>
                        {line.cancelled && (
                          <span className="text-[10px] rounded-md border border-red-200 bg-red-50 text-destructive px-1.5 py-px" style={{ fontWeight: 600 }}>
                            Cancelled
                          </span>
                        )}
                      </span>
                    </TableCell>
                  ),
                };
                return (
                  <TableRow key={line.id} className="bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2">
                    {cols.map((key) => cellMap[key]).filter(Boolean)}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination footer — mirrors the Partners listing data table
          (centered, text-sm) so the two surfaces feel sibling. */}
      {transactions.length > 0 && (
        <div data-table-meta className="shrink-0 border-t border-border bg-white px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3">
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
      )}
    </div>
  );
}

export function PartnerItemsTab({ vendor, hideHeader, compact, contextLabel, contextType, compactToolbar, flush, lockSubTab, locationView, locationName }: { vendor: Vendor; hideHeader?: boolean; compact?: boolean; contextLabel?: string; contextType?: "discount" | "premium"; /** When true, hides the Filters button, count chip, and column selector to declutter the toolbar in modal contexts (e.g. location detail modal). */ compactToolbar?: boolean; /** When true, drops the outer border + rounded-xl so the tab renders edge-to-edge inside its container (e.g. location detail modal Items tab). */ flush?: boolean; /** When set, forces the sub-tab to "sell", "purchase", or "transactions" and hides the trade switcher. Used by (1) the location detail modal Items tab — per architecture lockdown only Items They Sell shows there — and (2) the new top-level Transactions tab on partner + location detail, which mounts this component scoped to the Transactions sub-tab only. */ lockSubTab?: "sell" | "purchase" | "transactions"; /** When true, scopes the tab to location-level data only: hides the Items They Buy sub-tab (approved-buyer access is rarely location-specific — Home Depot doesn't get a different approved buyer list per store). Transactions expose the full Purchases/Sales/Returns switcher, same as partner level. */ locationView?: boolean; /** Display name of the location when locationView is on — drives the partner-vs-location copy in the qualify flow. */ locationName?: string }) {
  const { openLightbox } = usePersonLightbox();
  const generatedItems = useMemo(() => generateItemsFromVendor(vendor), [vendor]);
  const [addedItems, setAddedItems] = useState<PartnerItemData[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  /* Location scope shows a per-location SUBSET of the partner's
   * qualified items (a store rarely carries the full partner catalog).
   * Deterministic off (location, item) so reopening the modal shows the
   * same roster. Partner-qualified items NOT yet at this location stay
   * addable through the qualify flow — with priority + price locked to
   * the partner-level values, since neither can differ per location. */
  const locationScopedItems = useMemo(() => {
    if (!locationView) return generatedItems;
    const seed = locationName || "location";
    return generatedItems.filter((it) => hashStringForRestriction(`loc-item:${seed}:${it.id}`) % 100 < 55);
  }, [generatedItems, locationView, locationName]);
  /* Inventory-catalog items already qualified at the PARTNER level —
   * the qualify modal uses this in location scope to tell "already
   * qualified with the partner" (priority + price locked, sourced from
   * the partner record) from "first-time qualification" (values being
   * set for the whole partner). Seeded deterministically off
   * (partner, item) — ~40% of the catalog — until the real QV index
   * backs this surface. */
  const partnerQualifiedIds = useMemo(() => {
    const s = new Set<string>();
    INVENTORY_ITEMS.forEach((it) => {
      if (hashStringForRestriction(`partner-qualified:${vendor.id}:${it.id}`) % 100 < 40) s.add(it.id);
    });
    return s;
  }, [vendor.id]);

  const allItems = useMemo(() => [...addedItems, ...locationScopedItems], [addedItems, locationScopedItems]);

  const [subTab, setSubTab] = useState<SubTab>(lockSubTab || "sell");
  // Force the locked sub-tab if the prop is in effect (caller switched contexts).
  useEffect(() => { if (lockSubTab && subTab !== lockSubTab) setSubTab(lockSubTab); }, [lockSubTab, subTab]);
  // locationView hides Items They Buy entirely — bounce back to "sell" if
  // the user was somehow parked there when the prop flips on.
  useEffect(() => { if (locationView && subTab === "purchase") setSubTab("sell"); }, [locationView, subTab]);
  /* Items They Buy — Approved-to-Buy filter (default ON). When ON the
   * table narrows to restricted items this partner is explicitly cleared
   * to buy; the full catalog would otherwise drown the surface for any
   * partner that isn't a contract manufacturer. Toggling OFF surfaces a
   * yellow strip warning the user about the noise. Tracked separately
   * from the existing status filter pills so the two layer cleanly. */
  const [approvedToBuyOnly, setApprovedToBuyOnly] = useState(true);
  /* Transactions sub-tab — time window + direction filters. Time
   * defaults to 90 days so the table reads as a recent-activity
   * snapshot; "All time" is one click away. Direction defaults to
   * Purchased (the only side with data this push); Sold + Both are
   * teed up for the Item Transactions ship-out per Irtaza's concept.
   * (transactionRows / transactionKpis declared below, after the
   * searchQuery state they read from, to avoid a TDZ at first render.) */
  // Two independent date scopes on the Transactions tab — Eli's note:
  // a user may want KPIs scoped to "Last 90 days" but want to drill into
  // the items table at "Last year". historyRange drives the items table;
  // kpiRange drives the metric strip. Both default to 90d so the surface
  // reads consistent on first load — the user opts into divergence.
  const [historyRange, setHistoryRange] = useState<PurchaseHistoryRange>("90d");
  const [kpiRange, setKpiRange] = useState<PurchaseHistoryRange>("90d");
  const [transactionDirection, setTransactionDirection] = useState<TransactionDirection>("purchased");
  /* Cancelled quick filter — toggles the ledger down to cancelled
   * POs/SOs only. Reset on direction switch so a Purchases-side toggle
   * doesn't silently carry into the Sales ledger. */
  const [showCancelledOnly, setShowCancelledOnly] = useState(false);
  useEffect(() => { setShowCancelledOnly(false); }, [transactionDirection]);
  /* Transactions KPI strip — direction-agnostic key order. Mirrors the
   * Partner Dashboard / listing-page Insights pattern: a flat array
   * defines what cards are visible AND their left-to-right order,
   * drag-and-drop reorders by mutating it. Labels relabel per
   * direction at render time; the key set stays stable. */
  const [txKpiOrder, setTxKpiOrder] = useState<string[]>(["total", "qty", "count", "avg", "uniqueItems", "topItem"]);
  const moveTxKpi = useCallback((fromIndex: number, toIndex: number) => {
    setTxKpiOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [density, setDensity] = useState<Density>("condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  /* Edit-Configuration entry — when set, AddItemModal opens scoped to
   * that single item and jumps straight to the Configure Pricing step.
   * Kept on a separate piece of state from addModalOpen so the modal
   * doesn't reset edit context when its own internal handlers fire
   * onOpenChange(true) during transitions. */
  const [editConfigItem, setEditConfigItem] = useState<PartnerItemData | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  /** Item detail modal — uses the same QuickViewPanel that drives the
   *  Partners listing's item / location / contact quick views, so the
   *  visual + interaction language stays consistent across the module. */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  // Column state
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["item"]));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  // Transactions sub-tab has its own column set (different table surface).
  // Tracked in parallel so toggling visibility/order on Transactions never
  // mutates the Items table state and vice versa.
  const [txColumnOrder, setTxColumnOrder] = useState<string[]>([...DEFAULT_TRANSACTION_COLUMN_ORDER]);
  const [txColumnVisibility, setTxColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_TRANSACTION_COLUMN_VISIBILITY });
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  /* Transactions sub-tab — rows + KPIs computed here so the KPI strip
   * (rendered above the toolbar search row) and the table both read
   * from one source of truth. Time window + direction filters above
   * change which subset is in scope; search narrows by part number /
   * description. */
  const _tableRangeDays = useMemo(() => PURCHASE_HISTORY_RANGE_OPTIONS.find((o) => o.key === historyRange)?.days ?? null, [historyRange]);
  const _kpiRangeDays = useMemo(() => PURCHASE_HISTORY_RANGE_OPTIONS.find((o) => o.key === kpiRange)?.days ?? null, [kpiRange]);
  // Items-table rows — scoped to the user's selected items window. Search
  // applies here too so the table reflects exactly what the user is
  // hunting for.
  const transactionRows = useMemo(() => {
    if (transactionDirection === "purchased") {
      const all = getPurchaseHistoryForPartner(vendor.id, allItems);
      return filterPurchaseHistory(all, _tableRangeDays, searchQuery, showCancelledOnly);
    }
    if (transactionDirection === "sold") {
      const all = getSalesHistoryForPartner(vendor.id, allItems);
      return filterPurchaseHistory(all, _tableRangeDays, searchQuery, showCancelledOnly);
    }
    return [];
  }, [vendor.id, allItems, _tableRangeDays, searchQuery, transactionDirection, showCancelledOnly]);
  /* Ledger line counts — the toolbar counter and the Cancelled pill badge
   * both talk in transactions (flattened PO/SO lines), not item rows.
   * `total` is the all-time unfiltered ledger size so the counter can say
   * "X of Y transactions" when the window / search / cancelled filter
   * narrows the view; `cancelled` respects the window + search but not the
   * cancelled toggle so the badge stays stable while toggling. */
  const transactionCounts = useMemo(() => {
    const all = transactionDirection === "purchased"
      ? getPurchaseHistoryForPartner(vendor.id, allItems)
      : transactionDirection === "sold"
        ? getSalesHistoryForPartner(vendor.id, allItems)
        : [];
    const countLines = (rows: PurchaseHistoryRow[]) => rows.reduce((s, r) => s + r.lines.length, 0);
    return {
      total: countLines(all),
      filtered: countLines(transactionRows),
      cancelled: countLines(filterPurchaseHistory(all, _tableRangeDays, searchQuery, true)),
    };
  }, [vendor.id, allItems, transactionDirection, transactionRows, _tableRangeDays, searchQuery]);
  // KPI source rows — independently scoped to the KPI date window. Search
  // is intentionally NOT applied: KPIs reflect the partner's actual
  // exchange volume over the chosen window, not a filtered view. Lets the
  // user drill into a specific item in the table while keeping the headline
  // metrics anchored to the full window.
  const kpiSourceRows = useMemo(() => {
    if (transactionDirection === "purchased") {
      const all = getPurchaseHistoryForPartner(vendor.id, allItems);
      return filterPurchaseHistory(all, _kpiRangeDays, "");
    }
    if (transactionDirection === "sold") {
      const all = getSalesHistoryForPartner(vendor.id, allItems);
      return filterPurchaseHistory(all, _kpiRangeDays, "");
    }
    return [];
  }, [vendor.id, allItems, _kpiRangeDays, transactionDirection]);
  /* Lifetime-scoped Top item — per the spec, Top item by spend
   * (Purchases) and Top item by revenue (Sales) both ignore the KPI
   * date range and always reflect the partner's all-time leader.
   * Computed independently from kpiSourceRows so changing the KPI
   * window leaves this card alone. */
  const { lifetimeTopItem, lifetimeTopShare } = useMemo<{ lifetimeTopItem: PurchaseHistoryRow | null; lifetimeTopShare: number }>(() => {
    const all = transactionDirection === "purchased"
      ? getPurchaseHistoryForPartner(vendor.id, allItems)
      : transactionDirection === "sold"
        ? getSalesHistoryForPartner(vendor.id, allItems)
        : [];
    if (all.length === 0) return { lifetimeTopItem: null, lifetimeTopShare: 0 };
    const top = all.reduce((acc, r) => (r.totalSpend > acc.totalSpend ? r : acc), all[0]);
    const lifetimeTotal = all.reduce((s, r) => s + r.totalSpend, 0);
    return { lifetimeTopItem: top, lifetimeTopShare: lifetimeTotal > 0 ? (top.totalSpend / lifetimeTotal) * 100 : 0 };
  }, [vendor.id, allItems, transactionDirection]);
  const transactionKpis = useMemo(() => {
    let totalSpend = 0;
    let totalQty = 0;
    let totalPOs = 0;
    let lastDate: string | null = null;
    for (const r of kpiSourceRows) {
      totalSpend += r.totalSpend;
      totalQty += r.totalQty;
      totalPOs += r.poCount;
      if (!lastDate || r.lastDate > lastDate) lastDate = r.lastDate;
    }
    const avgPo = totalPOs > 0 ? totalSpend / totalPOs : 0;
    return {
      totalSpend: Number(totalSpend.toFixed(2)),
      totalQty,
      totalPOs,
      uniqueItems: kpiSourceRows.length,
      avgPo,
      topItem: lifetimeTopItem,
      topItemShare: lifetimeTopShare,
      lastDate,
    };
  }, [kpiSourceRows, lifetimeTopItem, lifetimeTopShare]);

  // Column drag reorder refs
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);

  // Column resize ref
  const resizeRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Helper to get column def
  const colDef = (key: string) => ITEM_COLUMN_DEFS.find((c) => c.key === key)!;

  // Valid column keys set
  const validColumnKeys = useMemo(() => new Set(ITEM_COLUMN_DEFS.map((c) => c.key)), []);

  // Visible columns in user-defined order
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(
      (key) => validColumnKeys.has(key) && columnVisibility[key] !== false
    );
    if (!ordered.includes("item")) {
      ordered.unshift("item");
    } else if (ordered[0] !== "item") {
      const idx = ordered.indexOf("item");
      ordered.splice(idx, 1);
      ordered.unshift("item");
    }
    return ordered;
  }, [columnOrder, columnVisibility, validColumnKeys]);

  // Visible columns for the Transactions sub-tab — locked "item" stays first.
  const txValidKeys = useMemo(() => new Set(TRANSACTION_COLUMN_DEFS.map((c) => c.key)), []);
  const txVisibleColumns = useMemo(() => {
    const ordered = txColumnOrder.filter(
      (key) => txValidKeys.has(key) && txColumnVisibility[key] !== false
    );
    if (!ordered.includes("item")) ordered.unshift("item");
    else if (ordered[0] !== "item") {
      const idx = ordered.indexOf("item");
      ordered.splice(idx, 1);
      ordered.unshift("item");
    }
    return ordered;
  }, [txColumnOrder, txColumnVisibility, txValidKeys]);

  // Frozen offsets
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  // Last frozen key
  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  // Column drag handler
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (isResizing) return;
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60;

    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX;
      const dy = moveEvt.clientY - colDragRef.current.startY;

      if (!colDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        colDragRef.current.isDragging = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDraggingColumnKey(colDragRef.current.columnKey);
      }

      const ghost = ghostElRef.current;
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;

      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();

      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key");
        if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;

        setColumnOrder((prev) => {
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        });
        colDragRef.current.lastSwapTime = now;
        break;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      if (colDragRef.current?.isDragging) {
        suppressNextClickRef.current = true;
        requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      }

      colDragRef.current = null;
      setDraggingColumnKey(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [isResizing]);

  // Column resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? parseInt(colDef(columnKey).minWidth, 10);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths]);

  // Sort handler
  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
    setCurrentPage(1);
  }, []);

  // Hide column handler
  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    setFrozenColumns((prev) => {
      if (!prev.has(columnKey)) return prev;
      const next = new Set(prev);
      next.delete(columnKey);
      return next;
    });
  }, []);

  // Freeze column handler
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== "item") {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }, []);

  // Sub-tab filtered
  const subTabFiltered = useMemo(() => {
    if (subTab === "sell") return allItems.filter((it) => it.tradeDirection === "sell" || it.tradeDirection === "both");
    if (subTab === "purchase") return allItems.filter((it) => it.tradeDirection === "purchase" || it.tradeDirection === "both");
    return allItems;
  }, [allItems, subTab]);

  // Quick filter counts
  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { all: subTabFiltered.length };
    c["Active"] = subTabFiltered.filter((it) => it.status === "Active").length;
    c["Inactive"] = subTabFiltered.filter((it) => it.status === "Inactive").length;
    c["Serialized"] = subTabFiltered.filter((it) => it.itemControlType === "Serialized").length;
    c["Non-Serialized"] = subTabFiltered.filter((it) => it.itemControlType === "Non-Serialized").length;
    c["Lot Controlled"] = subTabFiltered.filter((it) => it.itemControlType === "Lot Controlled").length;
    return c;
  }, [subTabFiltered]);

  // Apply filters + sort
  const filtered = useMemo(() => {
    let list = subTabFiltered;
    // Approved-to-Buy gate — only meaningful on the buy sub-tab; layers
    // BEFORE the status / control-type pills so the count chips below
    // already reflect the restricted-allowlist slice.
    if (subTab === "purchase" && approvedToBuyOnly) {
      list = list.filter((it) => isPartnerApprovedToBuy(vendor.id, it));
    }
    if (itemFilter === "Active") list = list.filter((it) => it.status === "Active");
    else if (itemFilter === "Inactive") list = list.filter((it) => it.status === "Inactive");
    else if (itemFilter === "Serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (itemFilter === "Non-Serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    else if (itemFilter === "Lot Controlled") list = list.filter((it) => it.itemControlType === "Lot Controlled");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.manufacturer.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        let aVal: string | number;
        let bVal: string | number;
        switch (sortConfig.key) {
          case "item": aVal = a.partNo; bVal = b.partNo; break;
          case "description": aVal = a.description; bVal = b.description; break;
          case "stock_status": aVal = a.stockStatus; bVal = b.stockStatus; break;
          case "item_type": aVal = a.itemType; bVal = b.itemType; break;
          case "control_type": aVal = a.itemControlType; bVal = b.itemControlType; break;
          case "category": aVal = a.category; bVal = b.category; break;
          case "on_hand": aVal = a.onHand; bVal = b.onHand; break;
          case "status": aVal = a.status; bVal = b.status; break;
          default: aVal = ""; bVal = "";
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return dir * aVal.localeCompare(bVal);
        }
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return list;
  }, [subTabFiltered, itemFilter, searchQuery, sortConfig]);

  // "All" is represented by recordsPerPage === -1.
  const effectiveRecordsPerPage = recordsPerPage === -1
    ? Math.max(1, filtered.length)
    : recordsPerPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectiveRecordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = filtered.slice((currentPage - 1) * effectiveRecordsPerPage, currentPage * effectiveRecordsPerPage);

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const itemsFilterCount =
    (itemFilter !== "all" ? 1 : 0) + (subTab === "purchase" && approvedToBuyOnly ? 1 : 0);
  const itemsEmptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : subTabFiltered.length,
    filteredCount: tableLoad.forceEmpty ? 0 : filtered.length,
    pageCount: paginated.length,
    searchQuery,
    filterCount: itemsFilterCount,
  });
  const itemsSuggestion = useMemo(() => {
    if (itemsEmptyKind !== "no-results" && itemsEmptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(searchQuery, subTabFiltered.flatMap((it) => [it.partNo, it.description, it.category, it.manufacturer, it.sku]));
  }, [itemsEmptyKind, searchQuery, subTabFiltered]);
  const itemsEmptyProps = itemsEmptyKind && {
    kind: itemsEmptyKind,
    entity: { singular: "item", plural: "items" },
    searchQuery,
    suggestion: itemsSuggestion,
    onApplySuggestion: (q: string) => { setSearchQuery(q); setCurrentPage(1); },
    filterCount: itemsFilterCount,
    onClearSearch: () => { setSearchQuery(""); setCurrentPage(1); },
    onClearFilters: () => { setItemFilter("all"); setApprovedToBuyOnly(false); setCurrentPage(1); },
    onClearAll: () => { setSearchQuery(""); setItemFilter("all"); setApprovedToBuyOnly(false); setCurrentPage(1); },
    onRetry: tableLoad.retry,
    retrying: tableLoad.retrying,
    onFirstPage: () => setCurrentPage(1),
    compact: !!compact,
    title: subTab === "purchase" ? "No approved items yet" : "No items yet",
    description: subTab === "purchase"
      ? "Items this partner is cleared to buy will show up here."
      : "Items this partner supplies as a qualified vendor will show up here.",
    onCreate: () => setAddModalOpen(true),
    createLabel: subTab === "sell" ? "Add as Qualified Vendor to an Item" : "Add as Approved Buyer to an Item",
  };

  const allPageSelected = paginated.length > 0 && paginated.every((it) => selectedRows.has(it.id));
  const somePageSelected = paginated.some((it) => selectedRows.has(it.id));

  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginated.forEach((it) => next.delete(it.id));
      } else {
        paginated.forEach((it) => next.add(it.id));
      }
      return next;
    });
  }, [allPageSelected, paginated]);

  const existingItemIds = useMemo(() => new Set(allItems.map((it) => it.id)), [allItems]);

  const handleItemsAdded = useCallback((items: PartnerItemData[]) => {
    setAddedItems((prev) => [...items, ...prev]);
    const newIds = new Set(items.map((it) => it.id));
    setHighlightedIds(newIds);
    setItemFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
    setTimeout(() => setHighlightedIds(new Set()), 3500);
  }, []);

  const handleItemRemoved = useCallback((id: string) => {
    setAddedItems((prev) => prev.filter((it) => it.id !== id));
    toast.success("Item removed");
  }, []);

  /* Edit-Configuration save — replaces the matching item in addedItems
   * with the updated payload so the new QV config persists on the row.
   * Falls back to a no-op if the id can't be found (defensive — shouldn't
   * happen since the modal only opens for items already in the list). */
  const handleItemEdited = useCallback((updated: PartnerItemData) => {
    setAddedItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }, []);

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-[#FEF08A] rounded-sm px-px">{part}</span>
      ) : (
        part
      )
    );
  };

  const QUICK_FILTERS: { key: ItemFilter; label: string; count: number }[] = [
    { key: "all", label: "All Items", count: filterCounts["all"] || 0 },
    { key: "Active", label: "Active", count: filterCounts["Active"] || 0 },
    { key: "Inactive", label: "Inactive", count: filterCounts["Inactive"] || 0 },
    { key: "Serialized", label: "Serialized", count: filterCounts["Serialized"] || 0 },
    { key: "Non-Serialized", label: "Non-Serialized", count: filterCounts["Non-Serialized"] || 0 },
    { key: "Lot Controlled", label: "Lot Controlled", count: filterCounts["Lot Controlled"] || 0 },
  ];

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Total table width for fixed layout
  const tableWidth = CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + ACTIONS_COL_WIDTH;

  // Cell renderer for each dynamic column key
  const renderCell = (item: PartnerItemData, colKey: string) => {
    const isComfort = density === "comfort";
    switch (colKey) {
      case "item": {
        const trail = item.id.split("-").pop();
        const numericId = trail && /^\d+$/.test(trail) ? String(parseInt(trail, 10) + 1) : "1";
        const itemUrl = `https://nimble-palette.lovable.app/items/${numericId}`;
        // Image — hover shows the dark preview popover; click opens
        //   the big item-detail modal (full image + code + description
        //   + partner + on-hand + Go-to-Item).
        // Item code — hover renders a blue underline; click opens the
        //   item detail page in a new browser tab. Click is
        //   stopPropagation'd so it doesn't trigger the image modal.
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isComfort ? "gap-3" : "gap-2.5"}`}>
              <HoverCard openDelay={250} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewData({
                        type: "item",
                        item: {
                          id: numericId,
                          name: item.partNo,
                          subtitle: item.category,
                          imageUrl: item.image,
                        },
                        vendorName: vendor.companyName,
                        navUrlOverride: itemUrl,
                        navLabelOverride: "Go to Item",
                      });
                    }}
                    className={`${isComfort ? "w-10 h-10" : "w-8 h-8"} rounded-lg bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]`}
                    title="View Item Details"
                  >
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                  </button>
                </HoverCardTrigger>
                <ItemHoverCardContent
                  image={item.image}
                  partNo={item.partNo}
                  category={item.category}
                  manufacturer={item.manufacturer}
                  description={item.description}
                  inventoryControl={item.itemControlType}
                  onHand={item.onHand}
                  onHandUnit={item.onHandUnit}
                  status={item.status}
                  preferredAcquisition={item.preferredAcquisition}
                />
              </HoverCard>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); window.open(itemUrl, "_blank", "noopener,noreferrer"); }}
                  className={`${isComfort ? "text-[13px]" : "text-sm"} whitespace-nowrap block truncate text-left cursor-pointer text-slate-800 hover:text-primary hover:underline transition-colors`}
                  style={{ fontWeight: 500 }}
                  title="Open item detail in a new tab"
                >
                  {highlightText(item.partNo)}
                </button>
                {isComfort && (
                  <span className="text-xs text-muted-foreground/60 truncate block">
                    {item.description || item.manufacturer}
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        );
      }
      case "description":
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <p className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 truncate`} style={{ fontWeight: 400 }}>
                {highlightText(item.description)}
              </p>
              {isComfort && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  SKU: {item.sku}
                </p>
              )}
            </div>
          </TableCell>
        );
      case "stock_status":
        return (
          <TableCell key={colKey}>
            <StockStatusDot status={item.stockStatus} />
          </TableCell>
        );
      case "item_type":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{item.itemType}</span>
          </TableCell>
        );
      case "control_type":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{item.itemControlType}</span>
          </TableCell>
        );
      case "category":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{highlightText(item.category)}</span>
          </TableCell>
        );
      case "additional_category":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1">
              <CategoryPill label={item.additionalCategory} />
              {item.category !== item.additionalCategory && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+1</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="z-[300]">
                    <span className="text-[11px]">{item.category}</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TableCell>
        );
      case "on_hand":
        // Single-line — unit moved to its own stocking_unit column
        // per stakeholder spec, which also keeps row heights uniform
        // across the table (matches Partners listing rhythm).
        return (
          <TableCell key={colKey} className="text-right !pr-3">
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700`} style={{ fontWeight: 600 }}>
              {item.onHand.toLocaleString()}
            </span>
          </TableCell>
        );
      case "stocking_unit":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{item.onHandUnit}</span>
          </TableCell>
        );
      case "preferred_acquisition":
        return (
          <TableCell key={colKey}>
            <AcqBadge method={item.preferredAcquisition} />
          </TableCell>
        );
      case "last_updated_by": {
        const updated = getLastUpdated(item.id, item.createdOn);
        const person = ITEM_TEAM_MEMBERS.find((m) => m.name === updated.name) ?? ITEM_TEAM_MEMBERS[0];
        return (
          <TableCell key={colKey}>
            <PersonCell person={person} isComfort={isComfort} />
          </TableCell>
        );
      }
      case "last_updated_on": {
        const d = new Date(getLastUpdated(item.id, item.createdOn).date);
        const formatted = isNaN(d.getTime())
          ? "—"
          : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{formatted}</span>
          </TableCell>
        );
      }
      case "created_on": {
        const d = new Date(item.createdOn);
        const formatted = isNaN(d.getTime())
          ? "—"
          : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{formatted}</span>
          </TableCell>
        );
      }
      case "created_by":
        return (
          <TableCell key={colKey}>
            <PersonCell person={item.createdBy} isComfort={isComfort} />
          </TableCell>
        );
      case "owner":
        return (
          <TableCell key={colKey}>
            <PersonCell person={item.owner} isComfort={isComfort} />
          </TableCell>
        );
      case "alt_units":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 whitespace-nowrap`}>{item.altUnits}</span>
          </TableCell>
        );
      case "inbound_location":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 truncate block max-w-[180px]`}>{item.inboundLocation}</span>
          </TableCell>
        );
      case "outbound_location":
        return (
          <TableCell key={colKey}>
            <span className={`${isComfort ? "text-[13px]" : "text-sm"} text-slate-700 truncate block max-w-[180px]`}>{item.outboundLocation}</span>
          </TableCell>
        );
      case "acquisition":
        // No flex-wrap — pills stay parallel on a single row. Column
        // min-width is sized to fit two pills side-by-side without
        // truncating, which keeps every row at the same height.
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1 whitespace-nowrap">
              {item.acquisitionMethods.map((m) => (
                <AcqBadge key={m} method={m} />
              ))}
            </div>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={colKey}>
            <StatusBadge status={item.status} />
          </TableCell>
        );
      default:
        return (<TableCell key={colKey}>{"\u2013"}</TableCell>);
    }
  };

  return (
    <>
      <div className={`bg-card overflow-clip flex flex-1 min-h-0 ${flush ? "" : compact ? "elevated-z" : "border border-border rounded-xl"}`} style={compact || flush ? undefined : { minHeight: 400 }}>
        <div className="flex-1 min-w-0 overflow-clip flex flex-col">

          {/* Header: Sub-tabs + Toolbar */}
          <div className="bg-card shrink-0">
            {/* Sub-tabs row — hidden when hideHeader is true OR when lockSubTab is set
                (location detail modal: only Items They Sell, so there's nothing to switch
                between). When locked, the explanatory tooltip moves up to the location
                modal's main tab strip, and the Add-as-Qualified-Vendor CTA moves into the
                toolbar row next to the column selector — keeps location-modal toolbars
                consistent with the rest of the module. */}
            {!hideHeader && !lockSubTab && (
            <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border">
              <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
              {/* Sub-tab palette: Sell = primary blue, Purchase = emerald.
                  Switched away from purple (#5B21B6) per stakeholder
                  feedback — blue + purple read as the same hue at a
                  glance; emerald gives real contrast. */}
              {/* The Transactions sub-tab was retired from this strip — the
                  partner detail page now exposes Transactions as its own
                  top-level tab next to Items / Pricing Rules, so duplicating
                  it inside the trade switcher confused navigation. The
                  exchange ledger lives only at the top level now. */}
              {([
                {
                  key: "sell" as SubTab,
                  label: "Items They Sell",
                  color: "#0548A3",
                  bg: "#EBF3FF",
                  tip: "Items where this partner is on the qualified-vendor list. They're one of the suppliers you're allowed to source these items from, not necessarily the only one.",
                  example: <>Add a part here to add this partner as a <span className="text-[#0548A3]" style={{ fontWeight: 600 }}>qualified vendor</span> on that item's detail page.</>,
                },
                {
                  key: "purchase" as SubTab,
                  label: "Items They Buy",
                  color: "#065F46",
                  bg: "#ECFDF5",
                  // COPY OWNER: needs Fatima review (Maureen as backup) per
                  // Eli's pass on Items They Buy. Leads with the restricted-
                  // item concept so the user understands what this tab even
                  // does — every catalog item open to everyone doesn't need a
                  // row here, only the cleared-list items do.
                  tip: "Restricted items this partner is explicitly cleared to buy from you, e.g. a contract manufacturer who can only order the parts you build for their program. Unrestricted items in your catalog are already open to every partner and don't need a row here.",
                  example: <>Add a part here to add this partner to that item's <span className="text-[#065F46]" style={{ fontWeight: 600 }}>approved-buyer list</span>.</>,
                },
              ]).filter((t) => (!lockSubTab || t.key === lockSubTab) && (!locationView || t.key !== "purchase")).map((t) => {
                const isActive = subTab === t.key;
                return (
                  <Tooltip key={t.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setSubTab(t.key); setCurrentPage(1); }}
                        className={`inline-flex items-center justify-center px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                          isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                        }`}
                        style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
                      >
                        {t.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                      <p className="text-slate-500">{t.tip}</p>
                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                        <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                        <p className="text-[11px] text-slate-700 mt-1">{t.example}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              </div>

              {/* Add Item Button — tinted CTA matching active sub-tab.
                  Action labels match the real-world relationship users
                  are creating: Sell = adding the partner as a qualified
                  vendor on an item; Purchase = adding the partner to
                  the item's approved-buyer list. */}
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                style={{
                  fontWeight: 600,
                  backgroundColor: subTab === "sell" ? "#EBF3FF" : "#ECFDF5",
                  borderColor: subTab === "sell" ? "#A8D2FF" : "#A7F3D0",
                  color: subTab === "sell" ? "#0548A3" : "#065F46",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#CFE6FF" : "#D1FAE5"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#EBF3FF" : "#ECFDF5"; }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{subTab === "sell" ? "Add as Qualified Vendor to an Item" : "Add as Approved Buyer to an Item"}</span>
              </button>
            </div>
            )}

            {/* Transactions direction strip — segmented control in the
                same slot the Items tab gives "Items They Sell / Items
                They Buy". Promotes Purchases / Sales / Returns out of
                the small chip row into a first-class tab control so
                the surface reads with the same hierarchy as the Items
                tab. Hidden when the whole header is hidden. Returns is
                greyed out until its feed lands. */}
            {!hideHeader && subTab === "transactions" && (
              <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border">
                <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
                  {([
                    {
                      key: "purchased" as TransactionDirection,
                      label: "Purchases",
                      color: "#0548A3",
                      comingSoon: false,
                      tip: "POs you raised against this partner. The ledger of what we bought from them, quantities, unit prices, and order numbers across the chosen window.",
                      example: <>Click <span className="text-[#0548A3]" style={{ fontWeight: 600 }}>Create New Purchase Order</span> to draft a new PO for this partner.</>,
                    },
                    {
                      key: "sold" as TransactionDirection,
                      label: "Sales",
                      color: "#065F46",
                      comingSoon: false,
                      tip: "SOs this partner placed against you. The ledger of what they bought from us, quantities, unit prices, and order numbers across the chosen window.",
                      example: <>Click <span className="text-[#065F46]" style={{ fontWeight: 600 }}>Create New Sales Order</span> to draft a new SO for this partner.</>,
                    },
                    {
                      key: "returns" as TransactionDirection,
                      label: "Returns",
                      color: "#6B21A8",
                      comingSoon: true,
                      tip: "Refunds, RMAs, and credit memos against this partner. Surfaces here once the returns feed lands, not yet wired.",
                      example: <>Comes online with the <span className="text-[#6B21A8]" style={{ fontWeight: 600 }}>returns module</span>. Until then, refunds and RMAs are logged in the source order.</>,
                    },
                  ]).map((t) => {
                    const isActive = transactionDirection === t.key;
                    const isDisabled = t.comingSoon;
                    return (
                      <Tooltip key={t.key}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { if (!isDisabled) setTransactionDirection(t.key); }}
                            disabled={isDisabled}
                            className={`inline-flex items-center gap-1.5 justify-center px-4 py-1.5 rounded-md text-[13px] transition-all ${
                              isActive
                                ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer"
                                : isDisabled
                                  ? "text-muted-foreground/50 cursor-not-allowed"
                                  : "text-slate-500 hover:text-slate-700 cursor-pointer"
                            }`}
                            style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
                          >
                            {t.label}
                            {t.comingSoon && (
                              <span className="text-[10px] px-1 py-px rounded-full bg-violet-50 text-violet-500 border border-violet-100" style={{ fontWeight: 600 }}>Soon</span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">{t.tip}</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1">{t.example}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

              </div>
            )}

            {/* Transactions KPI strip — only on the Transactions sub-tab,
                rendered ABOVE the search row so the surface reads as
                "headline metrics" first, then drill-down filters + table.
                White cards (not violet) + sentence-case labels matching
                the rest of the dashboard widgets. Horizontally scrollable
                on narrow surfaces so the strip never wraps awkwardly. */}
            {subTab === "transactions" && (transactionDirection === "purchased" || transactionDirection === "sold") && (() => {
              // Sales-direction relabel map — keeps the data shape and
              // the entire KPI block intact; only the user-facing
              // strings flip. Mirrors the spec's PO→SO / spend→revenue /
              // bought→sold mapping.
              const isSales = transactionDirection === "sold";
              const kpiLabels = {
                total: isSales ? "Total Revenue" : "Total Spend",
                qty: isSales ? "Units Sold" : "Units Bought",
                count: isSales ? "SOs" : "POs",
                avg: isSales ? "Avg SO Value" : "Avg PO Value",
                topItem: isSales ? "Top Item by Revenue" : "Top Item by Spend",
                topItemHover: isSales ? "Total Revenue" : "Total Spend",
                topItemPctLabel: isSales ? "% of Total Revenue" : "% of Total Buy",
                topItemPctChipTitle: isSales
                  ? "% of this partner's total revenue (lifetime)"
                  : "% of this partner's total buy (lifetime)",
              };
              return (
              <div className="px-4 pt-3 pb-1 shrink-0">
                {/* KPI period selector — independent from the items-table
                    date pills below. Same Calendar dropdown pattern the
                    partner Dashboard uses. Decoupling lets the user, for
                    example, hold KPIs at "Last 90 days" while drilling
                    into the table at "Last year". */}
                <div className="flex items-center gap-2 text-[12px] text-slate-500 mb-2">
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>KPIs</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                        <Calendar className="w-3 h-3" />
                        <span style={{ fontWeight: 500 }}>
                          {PURCHASE_HISTORY_RANGE_OPTIONS.find((o) => o.key === kpiRange)?.label ?? "Last 90 Days"}
                        </span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[170px]">
                      {PURCHASE_HISTORY_RANGE_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={opt.key}
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setKpiRange(opt.key)}
                        >
                          <span className="text-sm">{opt.label}</span>
                          {historyRange === opt.key && (
                            <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-slate-300">|</span>
                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>Scopes only the KPIs above. Items table uses its own period below.</span>
                </div>
              {(() => {
                // Card-body map keyed by the same direction-agnostic
                // keys that drive txKpiOrder. Top-item composite stays
                // intact (image + part-number link + percent chip);
                // the other five render as a single value line. The
                // outer card chrome (border, padding, label) lives on
                // DraggableTxKpiCard so all six share visuals while
                // being individually reorderable.
                const labelsByKey: Record<string, string> = {
                  total: kpiLabels.total,
                  qty: kpiLabels.qty,
                  count: kpiLabels.count,
                  avg: kpiLabels.avg,
                  uniqueItems: "Unique Items",
                  topItem: kpiLabels.topItem,
                };
                const bodiesByKey: Record<string, React.ReactNode> = {
                  total: (
                    <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 600 }}>${transactionKpis.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  ),
                  qty: (
                    <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 600 }}>{transactionKpis.totalQty.toLocaleString()}</p>
                  ),
                  count: (
                    <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 600 }}>{transactionKpis.totalPOs.toLocaleString()}</p>
                  ),
                  avg: (
                    <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 600 }}>${transactionKpis.avgPo.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  ),
                  uniqueItems: (
                    <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 600 }}>{transactionKpis.uniqueItems.toLocaleString()}</p>
                  ),
                  topItem: transactionKpis.topItem ? (() => {
                    const topItem = transactionKpis.topItem.item;
                    const { url, payload } = buildItemQuickViewPayload(topItem, vendor.companyName);
                    const pctOfTotal = transactionKpis.topItemShare;
                    const pctLabel = pctOfTotal >= 10 ? pctOfTotal.toFixed(0) : pctOfTotal.toFixed(1);
                    return (
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        <HoverCard openDelay={250} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              draggable={false}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setQuickViewData(payload); }}
                              className="w-5 h-5 rounded bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                              title="View Item Details"
                            >
                              <img src={topItem.image} alt="" className="w-full h-full object-cover" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="bottom"
                            align="start"
                            className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                          >
                            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                              <div className="flex items-center gap-3 relative">
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/5">
                                  <img src={topItem.image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{topItem.partNo}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{topItem.category} · {topItem.manufacturer}</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white px-4 py-3 space-y-2">
                              <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">{topItem.description}</p>
                              <div className="flex items-center justify-between pt-1.5 border-t border-muted gap-3">
                                <div>
                                  <p className="text-[10px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>{kpiLabels.topItemHover}</p>
                                  <p className="text-[14px] text-slate-700" style={{ fontWeight: 600 }}>${transactionKpis.topItem.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>{kpiLabels.topItemPctLabel}</p>
                                  <p className="text-[14px] text-slate-700" style={{ fontWeight: 600 }}>{pctLabel}%</p>
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }}
                          className="text-[13px] text-foreground truncate hover:text-primary hover:underline transition-colors cursor-pointer text-left min-w-0"
                          style={{ fontWeight: 600 }}
                          title={`${topItem.partNo} · $${transactionKpis.topItem.totalSpend.toLocaleString()} · ${pctLabel}% of total`}
                        >
                          {topItem.partNo}
                        </button>
                        <span
                          className="text-[10px] shrink-0 px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100"
                          style={{ fontWeight: 600 }}
                          title={kpiLabels.topItemPctChipTitle}
                        >
                          {pctLabel}%
                        </span>
                      </div>
                    );
                  })() : (
                    <p className="text-[13px] text-foreground mt-0.5 truncate" style={{ fontWeight: 600 }}>—</p>
                  ),
                };
                // locationView + compact paths skip drag-and-drop —
                // both render this tab inside a parent DndProvider
                // (Partner Locations / generic modal) and a second
                // HTML5Backend crashes react-dnd. Plain grid cards in
                // those modes; full reorder behaviour stays on the
                // top-level Transactions tab.
                const skipDnd = !!locationView || !!compact;
                const grid = (
                  <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {txKpiOrder.map((key, idx) =>
                      skipDnd ? (
                        <div
                          key={key}
                          className="rounded-lg border border-border bg-white px-3 py-2 min-w-0 overflow-hidden"
                        >
                          <p className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 500 }}>{labelsByKey[key]}</p>
                          {bodiesByKey[key]}
                        </div>
                      ) : (
                        <DraggableTxKpiCard
                          key={key}
                          index={idx}
                          kpiKey={key}
                          label={labelsByKey[key]}
                          moveCard={moveTxKpi}
                        >
                          {bodiesByKey[key]}
                        </DraggableTxKpiCard>
                      ),
                    )}
                  </div>
                );
                return skipDnd ? grid : <DndProvider backend={HTML5Backend}>{grid}</DndProvider>;
              })()}
              </div>
              );
            })()}

            {/* Toolbar row: Search + Filters ... Count + Density + ColumnSelector */}
            <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!compactToolbar && (
              <button
                type="button"
                onClick={() => toast.info("Advanced filters coming soon!")}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
              </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!compactToolbar && (
              <>
              <span data-table-meta className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {/* Transactions sub-tab counts flattened ledger lines, not
                    catalog items — "500 transactions", narrowing to
                    "X of Y transactions" when a filter is active. */}
                {subTab === "transactions" ? (
                  transactionCounts.filtered !== transactionCounts.total ? (
                    <>
                      <span className="text-foreground">{transactionCounts.filtered}</span>
                      <span className="text-muted-foreground/60"> of </span>
                      <span className="text-muted-foreground">{transactionCounts.total}</span>
                      <span className="text-muted-foreground/70"> transactions</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground">{transactionCounts.total}</span>
                      <span className="text-muted-foreground/70"> transactions</span>
                    </>
                  )
                ) : filtered.length !== allItems.length ? (
                  <>
                    <span className="text-foreground">{filtered.length}</span>
                    <span className="text-muted-foreground/60"> of </span>
                    <span className="text-muted-foreground">{allItems.length}</span>
                    <span className="text-muted-foreground/70"> items</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{allItems.length}</span>
                    <span className="text-muted-foreground/70"> items</span>
                  </>
                )}
              </span>

              <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />
              </>
              )}

              {!compact && (
              <>
              {/* Density dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    {density === "comfort" && <ListIcon className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    {density === "card" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                      {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                  {DENSITY_CONFIG.map((opt) => (
                    <DropdownMenuItem
                      key={opt.key}
                      className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                      onSelect={() => setDensity(opt.key)}
                    >
                      {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "list" && <ListIcon className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                      {density === opt.key && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Column Selector Trigger — hidden in compactToolbar
                  mode; disabled in card view since column visibility
                  doesn't apply to cards. */}
              {!compactToolbar && (
                <ColumnSelectorTrigger
                  visibleCount={subTab === "transactions" ? txVisibleColumns.length : visibleColumns.length}
                  active={columnDrawerOpen}
                  disabled={density === "card" && subTab !== "transactions"}
                  onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                />
              )}
              </>
              )}

              {/* Add Item — shown in compact mode */}
              {compact && (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-sm shadow-sm transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              )}

              {/* Add-as-Qualified-Vendor / Approved-Buyer CTA — surfaced in
                  the toolbar (next to the column selector) only when lockSubTab
                  pins the trade list (sell / purchase). Transactions has no
                  add action — the surface is a read-only ledger — so the CTA
                  hides in that mode. Mirrors the toolbar CTA placement used
                  elsewhere in the module. */}
              {lockSubTab && lockSubTab !== "transactions" && (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer shrink-0"
                  style={{
                    fontWeight: 600,
                    backgroundColor: subTab === "sell" ? "#EBF3FF" : "#ECFDF5",
                    borderColor: subTab === "sell" ? "#A8D2FF" : "#A7F3D0",
                    color: subTab === "sell" ? "#0548A3" : "#065F46",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#CFE6FF" : "#D1FAE5"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#EBF3FF" : "#ECFDF5"; }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{subTab === "sell" ? "Add as Qualified Vendor to an Item" : "Add as Approved Buyer to an Item"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
            {/* Transactions sub-tab — direction (Purchases / Sales /
                Returns) moved up to the segmented control at the top of
                the tab so this row only carries the items-table date
                range now. Independent from the KPI Calendar dropdown
                above so the user can hold headline metrics at one
                window while drilling into the table at another. */}
            {subTab === "transactions" && (
              <>
                <span className="text-[10px] text-slate-400 shrink-0 mr-0.5" style={{ fontWeight: 500 }}>Items Table:</span>
                {PURCHASE_HISTORY_RANGE_OPTIONS.map((opt) => {
                  const isActive = historyRange === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setHistoryRange(opt.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`}
                      style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "rgb(var(--primary))" : undefined }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {/* Separator + Cancelled toggle — status filter kept
                    visually apart from the date-range pills, mirroring
                    the | Archived pattern on the Partners listing.
                    Purchases-side only: the Sales ledger doesn't carry
                    a cancelled-SO quick filter. */}
                {transactionDirection !== "sold" && (
                  <>
                    <div className="w-px h-5 bg-border shrink-0" />
                    <button
                      onClick={() => setShowCancelledOnly((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        showCancelledOnly
                          ? "border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200"
                          : "border-red-200 text-destructive hover:bg-red-50 hover:border-red-300 active:bg-red-100"
                      }`}
                      style={{ fontWeight: showCancelledOnly ? 500 : 400, color: "rgb(var(--destructive))" }}
                    >
                      <XCircle className="w-3 h-3" />
                      Cancelled POs
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${showCancelledOnly ? "bg-red-100" : "bg-red-50"}`}
                        style={{ fontWeight: 600, color: "rgb(var(--destructive))" }}
                      >
                        {transactionCounts.cancelled}
                      </span>
                    </button>
                  </>
                )}
              </>
            )}
            {/* Restricted toggle — buy sub-tab only. Default ON so the
                surface is usable for any partner; users opt out to see
                the full catalog. Painted amber to match the "Restricted
                only" pill in the Add Approved-Buyer modal + the row-
                level Restricted badge, so all three "needs approval"
                touchpoints read as one visual primitive. */}
            {subTab === "purchase" && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      key="__restricted_only"
                      onClick={() => { setApprovedToBuyOnly((v) => !v); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        approvedToBuyOnly
                          ? "border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`}
                      style={{ fontWeight: approvedToBuyOnly ? 500 : 400, color: approvedToBuyOnly ? "#92400E" : undefined }}
                    >
                      <Shield className="w-3 h-3" />
                      Restricted
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${approvedToBuyOnly ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}
                        style={{ fontWeight: 600 }}
                      >
                        {(() => {
                          let n = 0;
                          for (const it of subTabFiltered) if (isPartnerApprovedToBuy(vendor.id, it)) n++;
                          return n;
                        })()}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[300px] z-[300]">
                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Restricted</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Some items are restricted, only specific partners are cleared to buy them from you. Toggled on, this filter is showing only the restricted items this partner is explicitly cleared to buy.
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      Everything else in your catalog is unrestricted and already available to every partner, so it doesn't need a per-partner entry.
                    </p>
                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                      <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                        A contract manufacturer who can only order the parts you build for their program, leave this on so you see exactly that cleared list. Toggle off to view the full catalog from this partner's perspective.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
                {/* Separator — visually anchors Restricted as the
                    primary protective filter and the rest as secondary
                    status pills. Mirrors the Me-mode | quick-pills layout
                    on the Partners listing page. */}
                <div className="w-px h-5 bg-border shrink-0" />
              </>
            )}
            {subTab !== "transactions" && QUICK_FILTERS.map((f) => {
              const isActive = itemFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { setItemFilter(f.key); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                  }`}
                  style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "rgb(var(--primary))" : undefined }}
                >
                  {f.label}
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                    style={{ fontWeight: 600, color: isActive ? "rgb(var(--primary))" : "rgb(var(--muted-foreground))" }}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Restricted ON banner — visual mirrors the "Pre-filled from
              Americas" strip in the Configure Vendor modal: full-width
              bar above the data table, single-line copy, white rounded
              badge holding the icon. Amber so it syncs with the
              Restricted pill + the row-level Restricted badge.

              Banner shows only on ON (Eli/business pass). OFF is the
              explicit audit view the user opted into; a warning there
              reads as alarmist. */}
          {subTab === "purchase" && approvedToBuyOnly && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50/70 px-4 py-2 flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-200 text-amber-700 shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <p className="text-[11px] text-amber-900 min-w-0 flex-1" style={{ fontWeight: 500 }}>
                Showing items this partner is explicitly cleared to buy from the full catalog, these are your{" "}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-amber-900 text-[11px] underline decoration-dotted underline-offset-2 cursor-help"
                      style={{ fontWeight: 600 }}
                    >
                      Restricted
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[300px] z-[300]">
                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Restricted Items</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Items only specific partners are cleared to buy from you. Unrestricted items in your catalog are open to every partner and don&apos;t need a per-partner entry.
                    </p>
                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                      <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                        A contract manufacturer who can only order the parts you build for their program, those parts are restricted, and this partner is on the approved-buyer list for each one.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
                {" "}items.
              </p>
            </div>
          )}
          </div>

          {/* Content */}
          {subTab === "transactions" ? (
            transactionDirection === "returns" ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-3">
                  <Receipt className="w-5 h-5 text-violet-600" />
                </div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Returns, Coming Soon</p>
                <p className="text-[12px] text-slate-500 mt-1 max-w-[340px]">
                  Returns aren't wired up yet, refunds, RMAs, and credit memos surface here once the returns feed lands. Switch back to <button onClick={() => setTransactionDirection("purchased")} className="underline cursor-pointer" style={{ fontWeight: 600 }}>Purchases</button> to see today's PO ledger.
                </p>
              </div>
            ) : (
              <PurchaseHistoryView
                rows={transactionRows}
                vendorName={vendor.companyName}
                onItemQuickView={(data) => setQuickViewData(data)}
                visibleColumns={txVisibleColumns}
                direction={transactionDirection}
              />
            )
          ) : density === "card" && !compact ? (
            /* Card View */
            <div className="p-4 min-h-0 overflow-y-auto flex-1">
              {tableLoad.loadState === "loading" ? (
                <CardSkeletonGrid />
              ) : itemsEmptyProps ? (
                <TableEmptyState {...itemsEmptyProps} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {paginated.map((item) => {
                    const isHighlighted = highlightedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`bg-white border rounded-xl cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:border-[#93B8F7]/50 transition-all duration-200 group/card flex flex-col overflow-hidden ${
                          isHighlighted
                            ? "border-primary shadow-[0_0_0_2px_rgba(10,119,255,0.15)]"
                            : "border-border"
                        }`}
                      >
                        {/* Image banner — large photo for card view, click opens lightbox */}
                        <div
                          className="relative w-full h-[200px] overflow-hidden bg-muted cursor-zoom-in"
                          onClick={(e) => { e.stopPropagation(); openLightbox({ src: item.image, name: item.description, subtitle: item.partNo }); }}
                        >
                          <img src={item.image} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" />
                          {/* Bottom-left: Status + Control pills on image */}
                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                            {isHighlighted && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-wider shadow-sm backdrop-blur-sm"
                                style={{ fontWeight: 700, backgroundColor: "rgba(10,119,255,0.9)", color: "#fff" }}
                              >
                                <Sparkles className="w-3 h-3" />
                                New
                              </span>
                            )}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] shadow-sm backdrop-blur-sm border"
                              style={{
                                fontWeight: 600,
                                backgroundColor: item.stockStatus === "In Stock" ? "rgba(236,253,245,0.92)" : item.stockStatus === "Low Stock" ? "rgba(255,251,235,0.92)" : "rgba(254,242,242,0.92)",
                                color: STOCK_STATUS_STYLES[item.stockStatus]?.color || "#065F46",
                                borderColor: STOCK_STATUS_STYLES[item.stockStatus]?.border || "#A7F3D0",
                              }}
                            >
                              {item.stockStatus}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] shadow-sm backdrop-blur-sm border"
                              style={{
                                fontWeight: 500,
                                backgroundColor: "rgba(241,245,249,0.92)",
                                color: "#334155",
                                borderColor: "#CBD5E1",
                              }}
                            >
                              {item.itemControlType}
                            </span>
                          </div>
                          {/* 3-dot menu on image */}
                          <div className="absolute top-2.5 right-2.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-white/80 backdrop-blur-sm text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-white hover:text-foreground transition-all cursor-pointer shadow-sm"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={compact ? "z-[230]" : ""} onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => toast.info("View item details coming soon!")}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                {subTab === "sell" && (
                                  <DropdownMenuItem onClick={() => setEditConfigItem(item)}>
                                    <Settings2 className="w-4 h-4 mr-2" /> Edit Configuration
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setRemoveConfirmId(item.id)}>
                                  <Trash2 className="w-4 h-4 mr-2 text-destructive" /> Remove Item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="flex flex-col flex-1">
                          {/* Title + Manufacturer */}
                          <div className="px-3.5 pt-2.5 pb-0">
                            <p className="text-[14px] text-slate-700 truncate" style={{ fontWeight: 600, lineHeight: "20px" }}>{item.description}</p>
                            <p className="text-[12px] text-slate-500 truncate mt-0.5" style={{ lineHeight: "18px" }}>
                              <span className="text-primary" style={{ fontWeight: 600 }}>{item.partNo}</span>
                              <span className="text-slate-300 mx-1.5">·</span>
                              {item.manufacturer}
                            </p>
                          </div>

                          {/* Stats — inline compact row (like location card) */}
                          <div className="px-3.5 pt-3 pb-3 flex-1 flex items-end">
                            <div className="flex items-center gap-3 text-[11px]">
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-700" style={{ fontWeight: 600 }}>{item.onHand.toLocaleString()}</span>
                                <span className="text-slate-400 text-[10px]">{item.onHandUnit}</span>
                              </div>
                              <div className="w-px h-3 bg-border" />
                              <div className="flex items-center gap-1">
                                {item.acquisitionMethods.map((m) => <AcqBadge key={m} method={m} />)}
                              </div>
                            </div>
                          </div>

                          {/* Footer — categories + status */}
                          <div className="px-3.5 py-2.5 border-t border-muted flex items-center justify-between">
                            <div className="flex items-center gap-1 min-w-0">
                              <CategoryPill label={item.category} />
                              {item.additionalCategory !== item.category && <CategoryPill label={item.additionalCategory} />}
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Table View — Condensed / Comfort */
            <div className={`min-h-0 overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
              <Table style={{ tableLayout: "fixed", width: `max(${tableWidth}px, 100%)` }}>
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                    density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                  }`}>
                    {/* Checkbox column — sticky leftmost */}
                    <TableHead
                      className="sticky left-0 z-20 bg-slate-50 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                    >
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    {/* Dynamic columns */}
                    {visibleColumns.map((key) => {
                      const def = colDef(key);
                      const isFrozen = frozenColumns.has(key);
                      const isLocked = LOCKED_COLUMNS.includes(key);
                      const isDraggable = !isLocked;
                      const currentColSort: "asc" | "desc" | null =
                        sortConfig?.key === key ? sortConfig.direction : null;
                      const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                      const isBeingDragged = draggingColumnKey === key;

                      return (
                        <TableHead
                          key={key}
                          data-col-drag-key={key}
                          onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                          onClickCapture={isDraggable ? (e) => {
                            if (suppressNextClickRef.current) {
                              e.stopPropagation();
                              e.preventDefault();
                            }
                          } : undefined}
                          className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                          style={{
                            width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
                            overflow: "hidden",
                            ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                            ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                            ...(isBeingDragged ? {
                              background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)",
                            } : {}),
                          }}
                        >
                          {/* Blue accent bar on top edge of dragged column header */}
                          {isBeingDragged && (
                            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "rgb(var(--primary))" }} />
                          )}
                          {/* Drag grip icon */}
                          {isDraggable && (
                            <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                          )}

                          <div className={`flex items-center ${def.align === "right" ? "w-full" : ""}`}>
                            <ColumnHeaderMenu
                              columnKey={key}
                              label={def.label}
                              sortable={def.sortable}
                              sortConfig={sortConfig}
                              onSort={handleSort}
                              onAddFilter={() => {}}
                              onHideColumn={handleHideColumn}
                              onFreezeColumn={handleFreezeColumn}
                              isFrozen={isFrozen}
                              isLocked={isLocked}
                              hasActiveFilter={false}
                            >
                              <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                <span className="text-[13px]" style={currentColSort ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                                {currentColSort === "asc" && (
                                  <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
                                )}
                                {currentColSort === "desc" && (
                                  <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
                                )}
                                {!currentColSort && def.sortable && (
                                  <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </ColumnHeaderMenu>
                          </div>

                          {/* Resize handle — right edge */}
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setColumnWidths((prev) => ({
                                ...prev,
                                [key]: parseInt(def.minWidth, 10),
                              }));
                            }}
                            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                            style={{ touchAction: "none" }}
                          >
                            <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                          </div>
                        </TableHead>
                      );
                    })}
                    {/* Actions column — sticky right */}
                    <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                      <span className="text-[13px]">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableLoad.loadState === "loading" ? (
                    <TableSkeletonRows columns={visibleColumns.length + 2} />
                  ) : itemsEmptyProps ? (
                    <TableEmptyRow colSpan={visibleColumns.length + 2} {...itemsEmptyProps} />
                  ) : (
                    paginated.map((item) => {
                      const isHighlighted = highlightedIds.has(item.id);
                      const isComfort = density === "comfort";
                      return (
                        <TableRow
                          key={item.id}
                          // Row click removed — interactions are now
                          // per-element: image opens the detail modal,
                          // item code opens the URL, Created By/Owner
                          // open the contact. Hover background still
                          // applied so cells in the row read together
                          // visually on hover.
                          className={`group hover:bg-[#F0F7FF] ${
                            density === "condensed"
                              ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2"
                              : density === "comfort"
                              ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                              : ""
                          } ${isHighlighted ? "animate-row-flash bg-accent/60" : ""}`}
                        >
                          {/* Checkbox cell — sticky leftmost */}
                          <TableCell
                            className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                          >
                            <Checkbox
                              checked={selectedRows.has(item.id)}
                              onCheckedChange={() => handleSelectRow(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${item.partNo}`}
                            />
                          </TableCell>
                          {visibleColumns.map((key) => {
                            const cell = renderCell(item, key);
                            const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                            const isDraggedCol = draggingColumnKey === key;
                            const cellWidthStyle: React.CSSProperties = {
                              width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                              ...(isDraggedCol ? {
                                backgroundColor: "rgba(10,119,255,0.035)",
                              } : {}),
                            };
                            if (frozenColumns.has(key)) {
                              const defAlign = colDef(key).align;
                              return cloneElement(cell, {
                                className: `${cell.props.className || ""} sticky z-10 bg-card group-hover:bg-[#F0F7FF] ${defAlign === "right" ? "text-right" : ""}`.trim(),
                                style: {
                                  ...cell.props.style,
                                  ...cellWidthStyle,
                                  left: `${frozenOffsets[key] ?? 0}px`,
                                  ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                },
                              });
                            }
                            const defAlign = colDef(key).align;
                            return cloneElement(cell, {
                              className: `${cell.props.className || ""} ${defAlign === "right" ? "text-right" : ""}`.trim(),
                              style: { ...cell.props.style, ...cellWidthStyle },
                            });
                          })}
                          {/* Actions — always last, always sticky */}
                          <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className={`w-[180px] ${compact ? "z-[230]" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem onClick={() => toast.info("View Details, coming soon")}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                {subTab === "sell" && (
                                  <DropdownMenuItem onClick={() => setEditConfigItem(item)}>
                                    <Settings2 className="w-4 h-4 mr-2" /> Edit Configuration
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive focus:bg-red-50"
                                  onClick={() => setRemoveConfirmId(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2 text-destructive" /> Remove Item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination — partner listing style. Hidden on the
              Transactions sub-tab since PurchaseHistoryView ships
              its own pagination at the bottom of its scroll area. */}
          {subTab !== "transactions" && filtered.length > 0 && (
            <div data-table-meta className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Records per Page</span>
                <Select
                  value={recordsPerPage === -1 ? "all" : String(recordsPerPage)}
                  onValueChange={(val) => {
                    setRecordsPerPage(val === "all" ? -1 : Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-sm text-muted-foreground"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </Button>

                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      className={`h-8 w-8 p-0 text-sm ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setCurrentPage(page as number)}
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-sm text-muted-foreground"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Column Selector Side Drawer — hidden in compact mode.
            Swaps to Transactions column defs when that sub-tab is active so
            the drawer reflects the actual rendered table columns. Sales
            relabels PO→SO / spend→revenue / bought→sold inline so the
            drawer mirrors the visible header. */}
        {!compact && (
        subTab === "transactions" ? (
          <ColumnSelector
            columns={(() => {
              const isSales = transactionDirection === "sold";
              return TRANSACTION_COLUMN_DEFS.map((c) => {
                if (!isSales) return c;
                if (c.key === "date") return { ...c, label: "Date Shipped" };
                if (c.key === "qty") return { ...c, label: "Quantity Shipped" };
                if (c.key === "order") return { ...c, label: "SO" };
                return c;
              });
            })()}
            columnOrder={txColumnOrder}
            columnVisibility={txColumnVisibility}
            onColumnOrderChange={setTxColumnOrder}
            onColumnVisibilityChange={setTxColumnVisibility}
            lockedColumns={TRANSACTION_LOCKED_COLUMNS}
            open={columnDrawerOpen}
            onOpenChange={setColumnDrawerOpen}
          />
        ) : (
          <ColumnSelector
            columns={ITEM_COLUMN_DEFS}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            onColumnOrderChange={setColumnOrder}
            onColumnVisibilityChange={setColumnVisibility}
            lockedColumns={LOCKED_COLUMNS}
            open={columnDrawerOpen}
            onOpenChange={setColumnDrawerOpen}
          />
        )
        )}
      </div>

      {/* Column drag ghost — positioned via ref for zero re-renders during mousemove */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: draggingColumnKey ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform",
          }}
        >
          {draggingColumnKey && (() => {
            const ghostSort = sortConfig?.key === draggingColumnKey ? sortConfig.direction : null;
            return (
              <div
                className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
                style={{
                  marginLeft: 12,
                  marginTop: -14,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(10,119,255,0.3)",
                  boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)",
                }}
              >
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
                <span className="text-[13px]" style={{ color: "rgb(var(--primary))", fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Add Item Modal */}
      <AddItemModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        existingItemIds={existingItemIds}
        existingItems={allItems}
        onItemsAdded={handleItemsAdded}
        onItemRemoved={handleItemRemoved}
        activeSubTab={subTab === "transactions" ? "purchase" : subTab}
        generic={compact}
        contextLabel={contextLabel}
        contextType={contextType}
        partnerId={vendor.id}
        locationName={locationView ? (locationName || "this location") : undefined}
        partnerQualifiedIds={locationView ? partnerQualifiedIds : undefined}
      />

      {/* Edit-Configuration Modal — same component as Add Item, opened
          in editMode so the surface jumps straight to Configure Pricing
          for one existing qualified-vendor item. */}
      <AddItemModal
        open={!!editConfigItem}
        onOpenChange={(o) => { if (!o) setEditConfigItem(null); }}
        existingItemIds={existingItemIds}
        existingItems={allItems}
        onItemsAdded={handleItemsAdded}
        onItemRemoved={handleItemRemoved}
        onItemEdited={handleItemEdited}
        activeSubTab="sell"
        generic={compact}
        contextLabel={contextLabel}
        contextType={contextType}
        partnerId={vendor.id}
        locationName={locationView ? (locationName || "this location") : undefined}
        partnerQualifiedIds={locationView ? partnerQualifiedIds : undefined}
        editMode
        editItem={editConfigItem}
      />

      {/* Remove item confirmation — gradient style */}
      <AlertDialog open={!!removeConfirmId} onOpenChange={(open) => { if (!open) setRemoveConfirmId(null); }}>
        <AlertDialogContent
          className={`sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${compact ? "z-[240]" : ""}`}
          overlayClassName={compact ? "z-[235]" : undefined}
          onInteractOutside={() => setRemoveConfirmId(null)}
        >
          {(() => {
            const removeItem = removeConfirmId ? allItems.find((it) => it.id === removeConfirmId) : null;
            return (
              <>
                {/* Gradient header */}
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
                    Caution
                  </span>
                </div>
                {/* Content */}
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                      Remove this item?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {removeItem && (
                      <>
                        <span style={{ fontWeight: 600, color: "#1E293B" }}>{removeItem.partNo}</span>
                        {" "}will be removed{compact ? "" : ` from ${subTab === "sell" ? "items they sell" : "items they buy"}`}. You can add it back later from the inventory.
                      </>
                    )}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction
                      onClick={() => {
                        if (removeConfirmId) {
                          handleItemRemoved(removeConfirmId);
                          setRemoveConfirmId(null);
                        }
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                    >
                      Remove Item
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      Cancel
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Item Detail Quick View ──
          Uses the same QuickViewPanel that the Partners listing uses
          for items, locations, contacts, and carriers. The panel
          handles its own backdrop / Escape close / image carousel /
          card layout, so the visual + interaction language is
          identical across the module. The Go-to-Item URL is
          overridden per-call to point at the canonical Items module. */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </>
  );
}

/* ── Draggable Transactions KPI card ──
 * Mirrors the DraggableKpiCard on the Partner Dashboard tab — same
 * grip-on-hover affordance, same swap-on-midpoint hover logic — but
 * scoped to the Transactions strip's six metric cards so the layout
 * matches the existing strip visual instead of inheriting the dash
 * card chrome wholesale. Body content is passed in via children so
 * the rich Top-item card (image + part-number link + percent chip)
 * can co-exist with the five simple value cards.
 */
const DND_TX_KPI = "TX_KPI_CARD";
function DraggableTxKpiCard({ index, kpiKey, label, moveCard, children }: {
  index: number;
  kpiKey: string;
  label: string;
  moveCard: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_TX_KPI,
    item: () => ({ index }),
    collect: (m) => ({ isDragging: m.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: DND_TX_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMidX = (hoverRect.right - hoverRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      if (dragIndex < hoverIndex && hoverClientX < hoverMidX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMidX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });
  preview(drop(ref));
  drag(ref);
  if (isDragging) {
    return (
      <div className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[56px] pointer-events-none" />
    );
  }
  return (
    <div
      ref={ref}
      data-kpi-key={kpiKey}
      className={`rounded-lg border bg-white px-3 py-2 group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <p className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 500 }}>{label}</p>
      {children}
    </div>
  );
}
