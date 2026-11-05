/* ═══════════════════════════════════════════════════════════════
   PO DEMANDS — full demand management page
   - Summary cards (Demand Gaps / Stale POs)
   - Demand Gaps section: By Item (aggregated) / By Source toggle
   - Low Stock Signals table
   - Stale POs section at bottom
   - Global search, filters, bulk actions, CSV export

   Purchase Requests are parked from procurement (2026-07-20 —
   SHOW_PURCHASE_REQUESTS_IN_PLANNER flag). The dormant tab config,
   summary metric, PR table, and handlers remain in the file so
   flipping the flag restores them; only visual/behavioural surfaces
   are gated.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  Check,
  X,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Package,
  Inbox,
  FileWarning,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical,
  MoreHorizontal,
  Clock,
  Ban,
  Eye,
  EyeOff,
  Building2,
  FileX2,
  SlidersHorizontal,
  Pencil,
  Columns3,
  AlignJustify,
  List,
  LayoutGrid,
  User,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import { FONT } from "./designTokens";
import UserHoverCard from "./UserHoverCard";
import ItemHoverCard from "./ItemHoverCard";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import UnifiedTransactionStream from "./UnifiedTransactionStream";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "./ui/sheet";
import { useOpenPlannerItems, openPlannerItem, useLastActiveItem } from "./plannerSession";
import { PlannerManageItemsModal, type PlannerInventoryItem } from "./PlannerManageItemsModal";
import { ColumnHeaderMenu, type SortConfig as CMSortConfig } from "./pocColumnHeaderMenu";
import { getPlannerUserMode, usePlannerUserMode } from "./plannerDevMode";
import { ImageWithFallback } from "./figma/ImageWithFallback";
/* DemandFiltersModal import retired — the Filters button + modal
   mount were dropped from `DemandTableToolbar`. The component still
   exists in the source tree and can be reintroduced if a tab branch
   wants its modal back. */
import { useNavigate } from "react-router-dom";
import { createPOFromVendorCheckout, getAllPOs, subscribeToPOStore, type PurchaseOrderData } from "./poStore";
import OrderFlow, {
  type OrderFlowItem,
  type OrderFlowResult,
  type DemandConsolidationContext,
} from "./OrderFlow";
import { getStatusBadgeCss } from "./statusColors";
import {
  PLANNER_ITEMS,
  PLANNER_DEMAND_EVENTS,
  getFutureIncomingForItem,
  getDemandEventsForItem,
  getSeededIncomingForItem,
  getDraftPOsForItem,
  getSeededDraftPOForItem,
  getAcquisitionForItem,
  sourceDocHref,
  type PlannerItem,
  type PlannerSeverity,
  type AcquisitionMethod,
  type ItemAcquisition,
} from "./plannerData";
import {
  projectAtpCurve,
  worstSeverityInHorizon,
  firstViolationDate,
  currentAtp as currentAtpOfCurve,
} from "../utils/projection";
import {
  DEFAULT_PARAMS,
  SHOW_PURCHASE_REQUESTS_IN_PLANNER,
  bandLabel,
  LEVEL_BANDS_BY_SEVERITY,
  loadParams,
  paramsEqual,
  saveParams,
  type LevelBand,
  type ProcurementPlanningParams,
} from "./procurementPlanningParams";
import { PlannerScopeBar } from "./PlannerScopeBar";
import { PlannerManageCategoriesModal } from "./PlannerManageCategoriesModal";
import { SystemDatePicker } from "./_dashboardModalKit";
import { PlannerScopeQuestionnaire } from "./PlannerScopeQuestionnaire";
import { ColumnSelector, ColumnSelectorTrigger } from "./pocColumnSelector";
import { OverflowTooltip, type OverflowItem } from "./pocOverflowTooltip";
import {
  buildRecommendations,
  type RecommendationConflict,
  type Recommendation,
} from "./procurementRecommendations";
import RecommendedPOsModal, {
  type ItemRecommendationInput,
} from "./RecommendedPOsModal";

/* ─────────────────────────────────────────────────────────────────
   FEATURE FLAGS
   ─────────────────────────────────────────────────────────────────
   The Low Stock sub-tab is intentionally hidden — its job (surface
   items that need buying) is now owned by the Procurement Planner
   top-level tab, which does the same work with forward-projected ATP
   instead of a `currentStock < reorderPoint` snapshot.

   The implementation below (data fixtures, render branch, helpers
   `urgencyForLowStockItem` / `openCreatePOForLowStockItem`, columns
   def, pagination state, etc.) is preserved verbatim. Flip this flag
   back to `true` to restore the sub-tab.
   ───────────────────────────────────────────────────────────────── */
const SHOW_LOW_STOCK_SUBTAB = false;

/* ─────────── Types ─────────── */

type DemandSourceKind = "SO" | "Request" | "LowStock";
/* ── Demand-source statuses — ship-by-date driven ──
   Critical : ≤ 7 days to ship
   At Risk  : 8–21 days
   Open     : > 21 days (or no ship-by date set)
*/
type Urgency = "Critical" | "At Risk" | "Open";
type RequestStatus = "Pending" | "Approved" | "Denied" | "Deferred";

interface DemandSource {
  kind: DemandSourceKind;
  /** SO number for kind=SO, requester for kind=Request, "Reorder Point" for kind=LowStock */
  reference: string;
  qty: number;
  /** Ship-by / need-by date the source carries. For SOs it's the
      customer ship date; for Requests it's the requester's need-by; for
      LowStock it can be left blank and we'll fall back to the parent
      item's `neededBy`. Drives urgency + the Need-by column display. */
  dueDate?: string;
  urgency: Urgency;
  /** For Request kind */
  reason?: string;
}

interface DemandItem {
  id: string;
  itemCode: string;
  itemName: string;
  itemImage: string;
  uom: string;
  currentStock: number;
  reorderPoint?: number; // Only for Low Stock items
  /** Ship-by / need-by date — drives the date-based urgency pill on
      the Low Stock table (≤ 7d → Critical, 8–21d → At Risk, > 21d → Open). */
  neededBy?: string;
  preferredVendor: string;
  vendorAbbr: string;
  unitPrice: number;
  leadDays: number;
  sources: DemandSource[];
}

interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  dueDate: string;
  lineItems: Array<{
    itemCode: string;
    itemName: string;
    need: number;
    have: number;
    uom: string;
  }>;
}

interface PurchaseRequest {
  id: string;
  requesterName: string;
  itemName: string;
  itemCode: string;
  itemImage: string;
  quantity: number;
  uom: string;
  reason: string;
  submittedDate: string;
  /** Ship-by / need-by date the requester set. Drives the Urgency pill
      (≤ 7 days → Critical, 8–21 → At Risk, > 21 → Open). */
  neededBy: string;
  status: RequestStatus;
  denyReason?: string;
  deferUntil?: string;
}

/* ─────────── Mock data — 20+ items, 10+ requests, 5 SOs, 15 low stock, 4 stale POs ─────────── */

const MOCK_DEMAND_ITEMS: DemandItem[] = [
  /* ── Synthetic filter-coverage fixtures (generated) — dual-sourced SO+Request ── */
  {
    id: "gdi-1",
    itemCode: "PL-BKZ1",
    itemName: "Braking Planning Part BKZ1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91000", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-2",
    itemCode: "PL-BKZ2",
    itemName: "Braking Planning Part BKZ2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91001", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-3",
    itemCode: "PL-BKZ3",
    itemName: "Braking Planning Part BKZ3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91002", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-4",
    itemCode: "PL-BKZ4",
    itemName: "Braking Planning Part BKZ4",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91003", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-5",
    itemCode: "PL-BKN1",
    itemName: "Braking Planning Part BKN1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91004", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-6",
    itemCode: "PL-BKN2",
    itemName: "Braking Planning Part BKN2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91005", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-7",
    itemCode: "PL-BKN3",
    itemName: "Braking Planning Part BKN3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91006", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-8",
    itemCode: "PL-BKN4",
    itemName: "Braking Planning Part BKN4",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91007", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-9",
    itemCode: "PL-BKX1",
    itemName: "Braking Planning Part BKX1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91008", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-10",
    itemCode: "PL-BKX2",
    itemName: "Braking Planning Part BKX2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91009", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-11",
    itemCode: "PL-DRZ1",
    itemName: "Drivetrain Planning Part DRZ1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91010", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-12",
    itemCode: "PL-DRZ2",
    itemName: "Drivetrain Planning Part DRZ2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91011", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-13",
    itemCode: "PL-DRN1",
    itemName: "Drivetrain Planning Part DRN1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91012", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-14",
    itemCode: "PL-DRN2",
    itemName: "Drivetrain Planning Part DRN2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91013", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-15",
    itemCode: "PL-DRN3",
    itemName: "Drivetrain Planning Part DRN3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91014", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-16",
    itemCode: "PL-DRN4",
    itemName: "Drivetrain Planning Part DRN4",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91015", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-17",
    itemCode: "PL-DRN5",
    itemName: "Drivetrain Planning Part DRN5",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91016", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-18",
    itemCode: "PL-DRX1",
    itemName: "Drivetrain Planning Part DRX1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91017", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-19",
    itemCode: "PL-DRX2",
    itemName: "Drivetrain Planning Part DRX2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91018", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-20",
    itemCode: "PL-DRX3",
    itemName: "Drivetrain Planning Part DRX3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91019", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-21",
    itemCode: "PL-ELZ1",
    itemName: "Electrical Planning Part ELZ1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91020", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-22",
    itemCode: "PL-ELZ2",
    itemName: "Electrical Planning Part ELZ2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91021", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-23",
    itemCode: "PL-ELZ3",
    itemName: "Electrical Planning Part ELZ3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91022", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-24",
    itemCode: "PL-ELZ4",
    itemName: "Electrical Planning Part ELZ4",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91023", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-25",
    itemCode: "PL-ELN1",
    itemName: "Electrical Planning Part ELN1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91024", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-26",
    itemCode: "PL-ELN2",
    itemName: "Electrical Planning Part ELN2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91025", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-27",
    itemCode: "PL-ELN3",
    itemName: "Electrical Planning Part ELN3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91026", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-28",
    itemCode: "PL-ELX1",
    itemName: "Electrical Planning Part ELX1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91027", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-29",
    itemCode: "PL-ELX2",
    itemName: "Electrical Planning Part ELX2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91028", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-30",
    itemCode: "PL-ELX3",
    itemName: "Electrical Planning Part ELX3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91029", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-31",
    itemCode: "PL-HYZ1",
    itemName: "Hydraulics Planning Part HYZ1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91030", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-32",
    itemCode: "PL-HYZ2",
    itemName: "Hydraulics Planning Part HYZ2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91031", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-33",
    itemCode: "PL-HYZ3",
    itemName: "Hydraulics Planning Part HYZ3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91032", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-34",
    itemCode: "PL-HYZ4",
    itemName: "Hydraulics Planning Part HYZ4",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 0,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91033", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-35",
    itemCode: "PL-HYN1",
    itemName: "Hydraulics Planning Part HYN1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91034", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-36",
    itemCode: "PL-HYN2",
    itemName: "Hydraulics Planning Part HYN2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91035", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-37",
    itemCode: "PL-HYN3",
    itemName: "Hydraulics Planning Part HYN3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 10,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91036", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-38",
    itemCode: "PL-HYX1",
    itemName: "Hydraulics Planning Part HYX1",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91037", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-39",
    itemCode: "PL-HYX2",
    itemName: "Hydraulics Planning Part HYX2",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91038", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  {
    id: "gdi-40",
    itemCode: "PL-HYX3",
    itemName: "Hydraulics Planning Part HYX3",
    itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200",
    uom: "EA",
    currentStock: 50,
    neededBy: "2026-07-15",
    preferredVendor: "Acme Supply Co (AS)",
    vendorAbbr: "AS",
    unitPrice: 120.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-91039", qty: 12, dueDate: "2026-07-10", urgency: "Open" },
      { kind: "Request", reference: "Areeb Tanvir", qty: 6, urgency: "Open", reason: "Replenishment" },
    ],
  },
  // Items with SO + Request + Low Stock demand
  {
    id: "di-1",
    itemCode: "HYD-4420-A1",
    itemName: "Hydraulic Pump Unit - Variable displacement axial-piston",
    itemImage: "https://images.unsplash.com/photo-1590239481209-b99e795df500?w=200",
    uom: "EA",
    currentStock: 12,
    reorderPoint: 50,
    neededBy: "2026-05-19",
    preferredVendor: "General Motors (GM)",
    vendorAbbr: "GM",
    unitPrice: 277.0,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-10428", qty: 20, dueDate: "2026-05-14", urgency: "Critical" },
      { kind: "SO", reference: "SO-10431", qty: 15, dueDate: "2026-05-18", urgency: "At Risk" },
      { kind: "SO", reference: "SO-10437", qty: 10, dueDate: "2026-05-22", urgency: "Open" },
      { kind: "SO", reference: "SO-10440", qty: 8, dueDate: "2026-05-25", urgency: "Open" },
      { kind: "SO", reference: "SO-10444", qty: 5, dueDate: "2026-06-01", urgency: "Open" },
      { kind: "Request", reference: "Nophil Anwer", qty: 5, urgency: "At Risk", reason: "Equipment replacement" },
      { kind: "LowStock", reference: "Min Order Qty:50", qty: 38, urgency: "Open" },
    ],
  },
  {
    id: "di-2",
    itemCode: "BFA-4210-R2",
    itemName: "Brake Friction Assembly - Ceramic compound",
    itemImage: "https://images.unsplash.com/photo-1625465329054-dde00a74a072?w=200",
    uom: "PR",
    currentStock: 4,
    reorderPoint: 30,
    neededBy: "2026-05-26",
    preferredVendor: "Ford Motor Company",
    vendorAbbr: "FM",
    unitPrice: 142.75,
    leadDays: 5,
    sources: [
      { kind: "SO", reference: "SO-10431", qty: 22, dueDate: "2026-05-15", urgency: "Critical" },
      { kind: "LowStock", reference: "Min Order Qty:30", qty: 26, urgency: "At Risk" },
    ],
  },
  {
    id: "di-3",
    itemCode: "CLP-2290-M3",
    itemName: "Carbon-Lined Piston",
    itemImage: "https://images.unsplash.com/photo-1564912139097-6e35a037c77f?w=200",
    uom: "EA",
    currentStock: 30,
    preferredVendor: "Toyota Technical Center (TTC)",
    vendorAbbr: "TT",
    unitPrice: 86.4,
    leadDays: 11,
    sources: [
      { kind: "SO", reference: "SO-10437", qty: 40, dueDate: "2026-05-20", urgency: "At Risk" },
    ],
  },
  {
    id: "di-4",
    itemCode: "AFE-5520-K1",
    itemName: "Air Filter Element - Heavy-duty pleated",
    itemImage: "https://images.unsplash.com/photo-1764537432322-dad234b0848d?w=200",
    uom: "EA",
    currentStock: 8,
    reorderPoint: 60,
    neededBy: "2026-05-21",
    preferredVendor: "Tesla, Inc.",
    vendorAbbr: "TI",
    unitPrice: 34.5,
    leadDays: 14,
    sources: [
      { kind: "SO", reference: "SO-10440", qty: 22, dueDate: "2026-05-25", urgency: "At Risk" },
      { kind: "Request", reference: "Shehryar Hasan", qty: 12, urgency: "Open", reason: "Maintenance kit" },
      { kind: "LowStock", reference: "Min Order Qty:60", qty: 52, urgency: "Open" },
    ],
  },
  {
    id: "di-5",
    itemCode: "RDC-4450-CU",
    itemName: "Radiator Cooling Assembly - Aluminum core",
    itemImage: "https://images.unsplash.com/photo-1760804462141-442810513d4e?w=200",
    uom: "EA",
    currentStock: 0,
    preferredVendor: "Honda Motor Co., Ltd. (USA)",
    vendorAbbr: "HM",
    unitPrice: 412.0,
    leadDays: 8,
    sources: [
      { kind: "SO", reference: "SO-10444", qty: 6, dueDate: "2026-05-14", urgency: "Critical" },
    ],
  },
  {
    id: "di-6",
    itemCode: "CVJ-5590-ST",
    itemName: "CV Joint Assembly - Outboard fixed",
    itemImage: "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?w=200",
    uom: "EA",
    currentStock: 45,
    preferredVendor: "BMW of North America",
    vendorAbbr: "BN",
    unitPrice: 198.4,
    leadDays: 15,
    sources: [
      { kind: "SO", reference: "SO-10451", qty: 50, dueDate: "2026-06-05", urgency: "Open" },
    ],
  },
  {
    id: "di-7",
    itemCode: "667205-32-41",
    itemName: "Brake Caliper Assembly - Single-piston sliding design",
    itemImage: "https://images.unsplash.com/photo-1625465329054-dde00a74a072?w=200",
    uom: "EA",
    currentStock: 18,
    reorderPoint: 50,
    neededBy: "2026-06-02",
    preferredVendor: "Chrysler (Stellantis N.V.)",
    vendorAbbr: "CS",
    unitPrice: 245.0,
    leadDays: 9,
    sources: [
      { kind: "LowStock", reference: "Min Order Qty:50", qty: 32, urgency: "At Risk" },
    ],
  },
  {
    id: "di-8",
    itemCode: "608497-26-54",
    itemName: "Suspension Coil Spring - Variable rate",
    itemImage: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=200",
    uom: "EA",
    currentStock: 24,
    reorderPoint: 50,
    neededBy: "2026-06-15",
    preferredVendor: "Lucid Motors",
    vendorAbbr: "LM",
    unitPrice: 124.5,
    leadDays: 18,
    sources: [{ kind: "LowStock", reference: "Min Order Qty:50", qty: 26, urgency: "Open" }],
  },
  {
    id: "di-9",
    itemCode: "511564-21-08",
    itemName: "Wheel Bearing Hub - Sealed double-row",
    itemImage: "https://images.unsplash.com/photo-1721048379815-751e1c6a748a?w=200",
    uom: "EA",
    currentStock: 9,
    reorderPoint: 50,
    neededBy: "2026-05-17",
    preferredVendor: "Rivian Automotive",
    vendorAbbr: "RA",
    unitPrice: 88.2,
    leadDays: 13,
    sources: [
      { kind: "SO", reference: "SO-10465", qty: 16, dueDate: "2026-06-06", urgency: "Critical" },
      { kind: "LowStock", reference: "Min Order Qty:50", qty: 41, urgency: "Critical" },
      { kind: "Request", reference: "Eli Rosenbloom", qty: 6, urgency: "At Risk", reason: "Line 3 conveyor maintenance" },
    ],
  },
  {
    id: "di-10",
    itemCode: "519574-21-08",
    itemName: "Ignition Coil Pack - Multi-cylinder direct",
    itemImage: "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?w=200",
    uom: "EA",
    currentStock: 35,
    reorderPoint: 50,
    neededBy: "2026-06-25",
    preferredVendor: "Toyota Technical Center (TTC)",
    vendorAbbr: "TT",
    unitPrice: 64.3,
    leadDays: 8,
    sources: [{ kind: "LowStock", reference: "Min Order Qty:50", qty: 15, urgency: "At Risk" }],
  },
  {
    id: "di-11",
    itemCode: "PB-9921-TR",
    itemName: "Power Brake Booster - Vacuum-assisted",
    itemImage: "https://images.unsplash.com/photo-1763848843013-e83a5f30b8e5?w=200",
    uom: "EA",
    currentStock: 5,
    reorderPoint: 30,
    neededBy: "2026-05-22",
    preferredVendor: "Nissan North America",
    vendorAbbr: "NA",
    unitPrice: 312.5,
    leadDays: 14,
    sources: [
      { kind: "SO", reference: "SO-10464", qty: 12, dueDate: "2026-06-09", urgency: "Critical" },
      { kind: "LowStock", reference: "Min Order Qty:30", qty: 25, urgency: "Critical" },
    ],
  },
  {
    id: "di-12",
    itemCode: "GT-7740-LX",
    itemName: "Gear Shift Lever Assembly",
    itemImage: "https://images.unsplash.com/photo-1767739791243-af1facf4b87b?w=200",
    uom: "EA",
    currentStock: 28,
    reorderPoint: 40,
    neededBy: "2026-07-01",
    preferredVendor: "Ford Motor Company",
    vendorAbbr: "FM",
    unitPrice: 72.95,
    leadDays: 12,
    sources: [{ kind: "LowStock", reference: "Min Order Qty:40", qty: 12, urgency: "Open" }],
  },
  {
    id: "di-13",
    itemCode: "BRG-7750-C3",
    itemName: "Precision Nitrile Roller Bearing - 62mm Bore",
    itemImage: "https://images.unsplash.com/photo-1721048379815-751e1c6a748a?w=200",
    uom: "BOX",
    currentStock: 50,
    preferredVendor: "Honda Motor Co., Ltd. (USA)",
    vendorAbbr: "HM",
    unitPrice: 47.25,
    leadDays: 6,
    sources: [{ kind: "SO", reference: "SO-10428", qty: 50, dueDate: "2026-05-14", urgency: "Critical" }],
  },
  {
    id: "di-14",
    itemCode: "ELC-1190-H2",
    itemName: "Automotive Wire Harness Connector - 24-pin IP67",
    itemImage: "https://images.unsplash.com/photo-1765555648980-c5ab1665604e?w=200",
    uom: "BAG",
    currentStock: 10,
    preferredVendor: "Tesla, Inc.",
    vendorAbbr: "TI",
    unitPrice: 17.39,
    leadDays: 10,
    sources: [
      { kind: "SO", reference: "SO-10428", qty: 30, dueDate: "2026-05-14", urgency: "Critical" },
    ],
  },
  {
    id: "di-15",
    itemCode: "GSK-3305-R1",
    itemName: "Industrial Nitrile Gasket Seal - 4\" OD x 3\" ID",
    itemImage: "https://images.unsplash.com/photo-1767608880954-f36dbd2e5ddb?w=200",
    uom: "PACK",
    currentStock: 10,
    preferredVendor: "Chrysler (Stellantis N.V.)",
    vendorAbbr: "CS",
    unitPrice: 6.4,
    leadDays: 4,
    sources: [{ kind: "SO", reference: "SO-10428", qty: 10, dueDate: "2026-05-14", urgency: "Critical" }],
  },
  {
    id: "di-16",
    itemCode: "FST-8810-SS",
    itemName: "Stainless Steel Hex Head Bolt - M12 x 60mm",
    itemImage: "https://images.unsplash.com/photo-1769971361558-3e32ddc52388?w=200",
    uom: "BOX",
    currentStock: 200,
    preferredVendor: "Ford Motor Company",
    vendorAbbr: "FM",
    unitPrice: 1.63,
    leadDays: 5,
    sources: [{ kind: "SO", reference: "SO-10431", qty: 500, dueDate: "2026-05-18", urgency: "At Risk" }],
  },
  {
    id: "di-17",
    itemCode: "ALU-5580-T6",
    itemName: "Aluminum Extrusion Profile - T-Slot 40x40mm 6061-T6",
    itemImage: "https://images.unsplash.com/photo-1658825959612-8f4bce484393?w=200",
    uom: "BUNDLE",
    currentStock: 12,
    reorderPoint: 20,
    neededBy: "2026-05-29",
    preferredVendor: "BMW of North America",
    vendorAbbr: "BN",
    unitPrice: 31.77,
    leadDays: 7,
    sources: [
      { kind: "SO", reference: "SO-10437", qty: 25, dueDate: "2026-05-22", urgency: "Open" },
      { kind: "LowStock", reference: "Min Order Qty:20", qty: 8, urgency: "Open" },
    ],
  },
  {
    id: "di-18",
    itemCode: "MBP-14-M3",
    itemName: "MacBook Pro 14\" - M3 chip, 32GB RAM",
    itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
    uom: "EA",
    currentStock: 0,
    preferredVendor: "Apple Inc.",
    vendorAbbr: "AP",
    unitPrice: 2599.0,
    leadDays: 21,
    sources: [{ kind: "Request", reference: "Areeb Tanvir", qty: 1, urgency: "Open", reason: "Replacement for failed dev machine" }],
  },
  {
    id: "di-19",
    itemCode: "FGM-ORG",
    itemName: "Figma Organization License",
    itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200",
    uom: "Seat",
    currentStock: 0,
    preferredVendor: "Figma, Inc.",
    vendorAbbr: "FI",
    unitPrice: 75.0,
    leadDays: 1,
    sources: [{ kind: "Request", reference: "Nophil Anwer", qty: 5, urgency: "Open", reason: "Design team expansion — 5 new seats needed" }],
  },
  {
    id: "di-20",
    itemCode: "SAF-GOG-Z87",
    itemName: "Industrial Safety Goggles - ANSI Z87.1",
    itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200",
    uom: "EA",
    currentStock: 60,
    preferredVendor: "Honeywell",
    vendorAbbr: "HW",
    unitPrice: 12.5,
    leadDays: 5,
    sources: [{ kind: "Request", reference: "Shehryar Hasan", qty: 24, urgency: "Open", reason: "Shop floor compliance refresh" }],
  },
];

const INITIAL_REQUESTS: PurchaseRequest[] = [
  { id: "pr-1", requesterName: "Areeb Tanvir", itemName: "MacBook Pro 14\" - M3 chip, 32GB RAM", itemCode: "LAP-MBP-14-M3", itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200", quantity: 1, uom: "EA", reason: "Replacement for failed dev machine", submittedDate: "2026-05-09", neededBy: "2026-05-19", status: "Pending" },
  { id: "pr-2", requesterName: "Nophil Anwer", itemName: "Figma Organization License", itemCode: "SW-FIGMA-ORG", itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200", quantity: 5, uom: "Seat", reason: "Design team expansion — 5 new seats needed", submittedDate: "2026-05-10", neededBy: "2026-05-28", status: "Pending" },
  { id: "pr-3", requesterName: "Shehryar Hasan", itemName: "Industrial Safety Goggles - ANSI Z87.1", itemCode: "SAF-GOG-Z87", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", quantity: 24, uom: "EA", reason: "Shop floor compliance refresh", submittedDate: "2026-05-08", neededBy: "2026-05-22", status: "Pending" },
  { id: "pr-4", requesterName: "Irtaza Abid", itemName: "Logitech MX Master 3S mouse", itemCode: "PERIPH-MX3S", itemImage: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200", quantity: 3, uom: "EA", reason: "Standard issue for new hires onboarding next week", submittedDate: "2026-05-11", neededBy: "2026-05-21", status: "Pending" },
  { id: "pr-5", requesterName: "Eli Rosenbloom", itemName: "Replacement bearing for line 3 conveyor", itemCode: "511564-21-08", itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200", quantity: 6, uom: "EA", reason: "Scheduled maintenance — downtime Friday", submittedDate: "2026-05-10", neededBy: "2026-05-22", status: "Pending" },
  { id: "pr-6", requesterName: "Areeb Tanvir", itemName: "Office chair - Herman Miller Aeron Size B", itemCode: "FURN-HM-AERON-B", itemImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200", quantity: 1, uom: "EA", reason: "Ergonomic accommodation", submittedDate: "2026-05-05", neededBy: "2026-06-15", status: "Approved" },
  { id: "pr-7", requesterName: "Nophil Anwer", itemName: "AWS Reserved Instance - m6i.2xlarge", itemCode: "CLOUD-AWS-M6I", itemImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200", quantity: 2, uom: "Unit", reason: "Increased compute for ML pipeline", submittedDate: "2026-05-04", neededBy: "2026-06-30", status: "Denied", denyReason: "Budget constraints" },
  { id: "pr-8", requesterName: "Shehryar Hasan", itemName: "Standing desk converter - VariDesk Pro Plus 36", itemCode: "FURN-VARI-36", itemImage: "https://images.unsplash.com/photo-1518542698903-cef942a8c7b1?w=200", quantity: 1, uom: "EA", reason: "Wellness initiative request", submittedDate: "2026-05-07", neededBy: "2026-07-01", status: "Deferred", deferUntil: "2026-06-01" },
  { id: "pr-9", requesterName: "Maria Garcia", itemName: "Network Switch - 48-port managed", itemCode: "NET-SW-48P", itemImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200", quantity: 2, uom: "EA", reason: "Office expansion to second floor", submittedDate: "2026-05-06", neededBy: "2026-06-05", status: "Pending" },
  { id: "pr-10", requesterName: "James Wilson", itemName: "Forklift propane tank", itemCode: "EQP-LPG-30LB", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", quantity: 4, uom: "EA", reason: "Warehouse operations consumable", submittedDate: "2026-05-08", neededBy: "2026-05-26", status: "Approved" },
  { id: "pr-11", requesterName: "Lisa Chen", itemName: "Cleanroom gloves - Nitrile XL", itemCode: "SAF-GLV-NIT-XL", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", quantity: 500, uom: "BOX", reason: "Quarterly stock replenishment", submittedDate: "2026-05-03", neededBy: "2026-06-20", status: "Approved" },
];

const MOCK_SOS: SalesOrder[] = [
  {
    id: "so-1",
    soNumber: "SO-10428",
    customer: "Acme Corp",
    dueDate: "2026-05-14",
    lineItems: [
      { itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit", need: 20, have: 12, uom: "EA" },
      { itemCode: "BRG-7750-C3", itemName: "Roller Bearing", need: 50, have: 50, uom: "BOX" },
      { itemCode: "ELC-1190-H2", itemName: "Wire Harness Connector", need: 30, have: 10, uom: "BAG" },
      { itemCode: "GSK-3305-R1", itemName: "Nitrile Gasket Seal", need: 10, have: 10, uom: "PACK" },
    ],
  },
  {
    id: "so-2",
    soNumber: "SO-10431",
    customer: "Widget Inc",
    dueDate: "2026-05-18",
    lineItems: [
      { itemCode: "BFA-4210-R2", itemName: "Brake Friction Assembly", need: 22, have: 4, uom: "PR" },
      { itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit", need: 15, have: 12, uom: "EA" },
      { itemCode: "FST-8810-SS", itemName: "Hex Head Bolt", need: 500, have: 200, uom: "BOX" },
    ],
  },
  {
    id: "so-3",
    soNumber: "SO-10437",
    customer: "Parts Co",
    dueDate: "2026-05-22",
    lineItems: [
      { itemCode: "CLP-2290-M3", itemName: "Carbon-Lined Piston", need: 40, have: 30, uom: "EA" },
      { itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit", need: 10, have: 12, uom: "EA" },
      { itemCode: "ALU-5580-T6", itemName: "Aluminum Extrusion", need: 25, have: 12, uom: "BUNDLE" },
    ],
  },
  {
    id: "so-4",
    soNumber: "SO-10440",
    customer: "AutoTech",
    dueDate: "2026-05-25",
    lineItems: [
      { itemCode: "AFE-5520-K1", itemName: "Air Filter Element", need: 22, have: 8, uom: "EA" },
      { itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit", need: 8, have: 12, uom: "EA" },
    ],
  },
  {
    id: "so-5",
    soNumber: "SO-10444",
    customer: "Mech Solutions",
    dueDate: "2026-05-14",
    lineItems: [
      { itemCode: "RDC-4450-CU", itemName: "Radiator Cooling Assembly", need: 6, have: 0, uom: "EA" },
      { itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit", need: 5, have: 12, uom: "EA" },
    ],
  },
];

const DENY_REASONS = [
  "Budget constraints",
  "Not approved at this time",
  "Item available in stock",
  "Duplicate request",
];

/* ─────────── Helpers ─────────── */

/* ── Demand documents ──────────────────────────────────────────
   Demand comes from real documents only: Sales Orders + Purchase
   Requests. Low Stock is NOT a demand source — sitting under the
   reorder floor is a stocking-level ISSUE (Below Minimum) and is
   already carried by the Issues column; counting it here would
   double-signal the same fact and inflate GAP. */
function demandDocsFor(item: DemandItem): DemandSource[] {
  return item.sources.filter((s) => s.kind !== "LowStock");
}

function totalDemandFor(item: DemandItem): number {
  return demandDocsFor(item).reduce((sum, s) => sum + s.qty, 0);
}

function gapFor(item: DemandItem): number {
  return item.currentStock - totalDemandFor(item);
}

/* ── Stocking-level severity bands ──────────────────────────────
   Classify an item by where its current ATP sits relative to its
   min / max stocking levels. The three bands are disjoint, so every
   item falls into at most one (items at/above max are healthy →
   null). Drives the band filter chips, the severity sort, and the
   Issues column read. */
function bandForAtp(
  atp: number,
  minLevel: number,
  maxLevel: number,
): LevelBand | null {
  if (atp < 0) return "below-zero";
  if (atp < minLevel) return "below-min";
  /* Above-max ADDED 2026-07-14 — Nophil: overstock (ordered then SO
     cancelled / BOM changed) needs to be surfaced as an issue, not
     lumped with "healthy". Check AFTER the shortage bands so real
     stockouts still win the severity race. */
  if (atp > maxLevel) return "above-max";
  /* Healthy zone (buyer feedback 2026-07-20): items sitting in the top
     half of the [min, max] range are truly "no action needed" — no
     issue chip. Items below that midpoint but above min are still
     shown as an early "below max" warning so the buyer can catch
     items trending down before they cross min. Previously the healthy
     branch was so tight (`atp === maxLevel`) that no item ever hit
     it, so "Include items without issues" surfaced nothing new. */
  const healthyFloor = minLevel + (maxLevel - minLevel) / 2;
  if (atp < healthyFloor) return "below-max";
  return null;
}

/* Most-severe-first rank. Higher = more severe. Healthy (no band) = 0,
   so it always sorts below any banded row. Above-max sits between
   below-min and below-max — overstock is real but never blocks a
   production line the way a shortage does. */
const BAND_SEVERITY: Record<LevelBand, number> = {
  "below-zero": 4,
  "below-min": 3,
  "above-max": 2,
  "below-max": 1,
};
function severityRank(band: LevelBand | null | undefined): number {
  return band ? BAND_SEVERITY[band] : 0;
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

/* Convert a ship-by date into the new 3-band status:
   ≤ 7 days → Critical, 8–21 → At Risk, > 21 (or no date) → Open. */
function urgencyFromDate(dueDate?: string): Urgency {
  if (!dueDate) return "Open";
  const days = Math.ceil(
    (new Date(dueDate).getTime() - TODAY.getTime()) / 86400000,
  );
  if (days <= 7) return "Critical";
  if (days <= 21) return "At Risk";
  return "Open";
}

/* Resolve the effective ship-by date for a source, falling back to the
   parent item's `neededBy` for LowStock kind (since the source itself
   doesn't carry a date). Returns undefined when no date is known. */
function sourceDueDate(item: DemandItem, s: DemandSource): string | undefined {
  if (s.dueDate) return s.dueDate;
  if (s.kind === "LowStock") return item.neededBy;
  return undefined;
}

/* Per-source status. Derives from the resolved due date so SO + Request
   + LowStock all share one rule (≤ 7d / ≤ 21d / else). Falls back to
   the source's stored `urgency` field only if no date is available. */
function urgencyForSourceWithItem(item: DemandItem, s: DemandSource): Urgency {
  const date = sourceDueDate(item, s);
  if (date) return urgencyFromDate(date);
  return s.urgency;
}

/* Backwards-compat shim used where the parent item isn't in scope. */
function urgencyForSource(s: DemandSource): Urgency {
  if (s.kind === "SO") return urgencyFromDate(s.dueDate);
  return s.urgency;
}

/* Top-level Request status. Drives the Urgency pill on the Purchase
   Requests table. Same ship-by thresholds as SOs (≤7 / ≤21 / else). */
function urgencyForRequest(r: PurchaseRequest): Urgency {
  return urgencyFromDate(r.neededBy);
}

/* Top-level Low-Stock status. Same ship-by date rule as SOs and
   Requests — drives the Need-by date colouring in the Low Stock table. */
function urgencyForLowStockItem(item: DemandItem): Urgency {
  return urgencyFromDate(item.neededBy);
}

/* Item-level status — worst-case across all sources. */
function urgencyForItem(item: DemandItem): Urgency {
  const tones = item.sources.map(urgencyForSource);
  if (tones.includes("Critical")) return "Critical";
  if (tones.includes("At Risk")) return "At Risk";
  return "Open";
}

/* `daysToEarliestNeed` — days from today to the earliest source need-by
   date (negative = past, 999 = no date known). Still used by the timing
   filter + the expanded-panel "earliest need" line. */
function daysToEarliestNeed(item: DemandItem): number {
  const dates = item.sources
    .map((s) => sourceDueDate(item, s))
    .filter((d): d is string => !!d);
  if (item.neededBy) dates.push(item.neededBy);
  if (dates.length === 0) return 999;
  const days = dates.map((d) =>
    Math.ceil((new Date(d).getTime() - TODAY.getTime()) / 86400000),
  );
  return Math.min(...days);
}

/* Earliest concrete need-by date across the item's demand documents
   (SO ship dates + Request need-bys), falling back to the item-level
   `neededBy`. Returns undefined when no date is known — the Need by
   cell renders "—" and the column sorts those rows last. */
function earliestNeedDate(item: DemandItem): string | undefined {
  const dates = demandDocsFor(item)
    .map((s) => s.dueDate)
    .filter((d): d is string => !!d);
  if (item.neededBy) dates.push(item.neededBy);
  if (dates.length === 0) return undefined;
  return dates.sort()[0];
}

/* "May 14, 2026" — same date shape the Purchase Orders table uses.
   Parses at local midnight so the rendered day never drifts across
   timezones. */
const NEED_BY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtNeedBy(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${NEED_BY_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

/* ── AVATAR — palette + LetterAvatar lifted from PurchaseOrdersListing for visual parity ── */

const AVATAR_COLORS = [
  { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFEFF", text: "#0891B2" },
  { bg: "#FFF1F2", text: "#E11D48" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#F0FDFA", text: "#0D9488" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#F5F5F4", text: "#57534E" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** 32×32 letter avatar matching Purchase Orders. Companies = rounded-lg, people = rounded-full. */
function LetterAvatar({
  letter,
  name,
  shape = "lg",
  size = 32,
}: {
  letter: string;
  name: string;
  shape?: "lg" | "full";
  size?: number;
}) {
  const color = avatarColor(name);
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden border ${
        shape === "lg" ? "rounded-lg" : "rounded-full"
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size >= 28 ? "10px" : "9px",
        fontWeight: 700,
        fontFamily: FONT,
        backgroundColor: color.bg,
        color: "rgb(51, 65, 85)",
        borderColor: "#E8ECF1",
      }}
    >
      {letter}
    </span>
  );
}

/* Back-compat alias — older call sites use AvatarCircle (people only); render as rounded-full LetterAvatar */
function AvatarCircle({ name, size = 32, initials }: { name: string; size?: number; initials?: string }) {
  const letter =
    initials ||
    name
      .split(" ")
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return <LetterAvatar letter={letter} name={name} shape="full" size={size} />;
}

/* ─────────── Pill ─────────── */

/* All tones include a border so pills match the ER Library bordered-pill spec
   (`text-[11px] px-2 py-0.5 rounded-full border tabular-nums`). */
const PILL_TONE: Record<string, { bg: string; fg: string; border: string }> = {
  Critical: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
  "At Risk": { bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA" },
  Open: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  Pending: { bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA" },
  Approved: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  Denied: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
  Deferred: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
  /* Source pills — kept neutral to reduce visual noise on the All Demand row.
     The kind is readable from the text; no need to colour-code. */
  SO: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
  Request: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
  LowStock: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
};

/** Rich empty-state row — lifted from PODataTable for visual parity.
    Renders a 64×64 circular icon container, title, subtitle, and optional CTA buttons. */
function EmptyState({
  icon: Icon = FileX2,
  title,
  description,
  cta,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="flex flex-col items-center gap-5 max-w-xs text-center">
        <div
          className="flex items-center justify-center size-16 rounded-full"
          style={{ backgroundColor: "hsl(var(--secondary))" }}
        >
          <Icon
            className="size-7"
            style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
            strokeWidth={1.5}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[13px]"
            style={{ color: "hsl(var(--foreground))", fontWeight: 500, fontFamily: FONT }}
          >
            {title}
          </span>
          <span
            className="text-[12px]"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            {description}
          </span>
        </div>
        {cta && <div className="flex items-center gap-2 mt-1">{cta}</div>}
      </div>
    </div>
  );
}

/** Status/urgency/source pill — matches PurchaseOrdersListing.StatusBadge shape:
    `rounded-md px-2 py-0.5 text-xs border`, weight 500. */
function Pill({ label, displayLabel }: { label: string; displayLabel?: string }) {
  const p = PILL_TONE[label] || { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" };
  return (
    <span
      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border"
      style={{
        fontWeight: 500,
        backgroundColor: p.bg,
        color: p.fg,
        borderColor: p.border,
        fontFamily: FONT,
      }}
    >
      {displayLabel || label}
    </span>
  );
}

/* ─────────── Sources cell — clickable document links ───────────
   The Sources cell renders one link per source kind — "5 Sales Orders
   · 1 Purchase Request" — adapting the Partners listing's linked-
   entities recipe (2-letter type tile + count link + popover).
   Hovering a link explains what the source kind means; clicking opens
   a popover listing the underlying documents (ref · qty · date/reason)
   so the buyer reads the demand without leaving the row. Low Stock
   never appears here — being under the reorder floor is an ISSUE
   (Below Minimum), not a demand source. */

const SOURCE_LINK_META: Record<
  "SO" | "Request",
  {
    /** 2-letter tile — Partners' ENTITY_TYPE_META recipe (SO = green). */
    tile: { code: string; color: string; bg: string; border: string };
    singular: string;
    plural: string;
    explainer: string;
  }
> = {
  SO: {
    tile: { code: "SO", color: "hsl(var(--success))", bg: "#ECFDF5", border: "#A7F3D0" },
    singular: "Sales Order",
    plural: "Sales Orders",
    explainer:
      "Sales Orders — confirmed customer orders that consume this item.",
  },
  Request: {
    tile: { code: "PR", color: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
    singular: "Purchase Request",
    plural: "Purchase Requests",
    explainer:
      "Purchase Requests — internal asks from teammates to buy this item.",
  },
};

/* `sourceDocHref` (the SO / Purchase-Request document routes) now lives in
   plannerData.ts as the single source of truth — shared with the gap-graph
   hover cards and the Transaction Table source cell. Imported above. */

/** Customer behind a Sales Order reference — enriches the popover row. */
function soCustomerFor(ref: string): string | undefined {
  return MOCK_SOS.find((so) => so.soNumber === ref)?.customer;
}

/* Single combined source label ("5 sources") with the Partners OverflowTooltip
   on hover. Replaces the former two separate "3 SO" / "2 PR" count pills
   (Nophil/Eli #21: one label, with a dropdown to see all). The dropdown lists
   every document across both kinds; each row keeps its own colored kind tile
   (SO / PR) so the breakdown stays legible. Reference IDs are NEW-TAB links
   with a ↗ icon (`showNameLinkIcon`) — placeholder route, see `sourceDocHref`. */
function CombinedSourcePill({
  soDocs,
  prDocs,
  uom,
}: {
  soDocs: DemandSource[];
  prDocs: DemandSource[];
  uom: string;
}) {
  const rowsFor = (kind: "SO" | "Request", docs: DemandSource[]): OverflowItem[] => {
    const meta = SOURCE_LINK_META[kind];
    return docs.map((d, i) => ({
      id: `${kind}-${d.reference}-${i}`,
      name: d.reference,
      nameHref: sourceDocHref(kind, d.reference),
      subtitle:
        kind === "SO"
          ? [soCustomerFor(d.reference), d.dueDate ? `Due ${fmtNeedBy(d.dueDate)}` : null, `${d.qty} ${uom}`]
              .filter(Boolean)
              .join(" · ")
          : [d.reason || null, `${d.qty} ${uom}`].filter(Boolean).join(" · "),
      /* Colored 2-letter mini-tile per row (Partners initials-avatar branch). */
      initials: meta.tile.code,
      avatarBg: meta.tile.bg,
      avatarFg: meta.tile.color,
    }));
  };
  const items: OverflowItem[] = [...rowsFor("SO", soDocs), ...rowsFor("Request", prDocs)];
  const total = items.length;
  return (
    <OverflowTooltip items={items} category="Sources" showNameLinkIcon>
      <span
        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] tabular-nums cursor-default"
        style={{
          fontWeight: 600,
          backgroundColor: "hsl(var(--secondary))",
          color: "hsl(var(--secondary-foreground))",
          borderColor: "hsl(var(--border))",
          fontFamily: FONT,
        }}
        aria-label={`${total} ${total === 1 ? "source" : "sources"}`}
      >
        {total} {total === 1 ? "source" : "sources"}
      </span>
    </OverflowTooltip>
  );
}

/** Forward-looking projection pill — surfaces the Procurement Planner's
    ATP projection signal in the Demands row. Inline next to the itemCode,
    compact (text 10.5px), so the row stays scannable. Healthy projections
    render nothing — only items at risk get a pill.

    `below_min`: amber. `at_zero` / `negative`: red. Tooltip carries the
    first-violation date so the buyer knows *when* it bites.

    Clickable — fires `onClick` so the host can open the Cause modal in-place
    (saving the buyer a flask-handoff round-trip just to investigate the
    "why"). When `onClick` is omitted the pill renders as a static span. */
function ProjectionPill({
  projection,
  onClick,
}: {
  projection?: { worstSeverity: PlannerSeverity; firstViolation: string | null; currentAtp?: number; baseUom?: string };
  onClick?: () => void;
}) {
  if (!projection || projection.worstSeverity === "healthy") return null;
  const tone =
    projection.worstSeverity === "below_min"
      ? { bg: "#fff6e9", fg: "#a06515", border: "#d48e2933", label: "Below min" }
      : { bg: "#fdecee", fg: "#a01a30", border: "#c9324833", label: projection.worstSeverity === "negative" ? "Stockout" : "At zero" };
  const dayDelta = (() => {
    if (!projection.firstViolation) return null;
    const ms = new Date(projection.firstViolation).getTime() - Date.now();
    const days = Math.max(0, Math.ceil(ms / 86_400_000));
    return days;
  })();
  const label = dayDelta !== null ? `${tone.label} in ${dayDelta}d` : tone.label;
  const tip = projection.firstViolation
    ? `Click to see why — projection drops below min on ${projection.firstViolation}`
    : `Click to see why — projection drops below min within 30 days`;
  const baseStyle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    backgroundColor: tone.bg,
    color: tone.fg,
    borderColor: tone.border,
    fontFamily: FONT,
  };
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded border cursor-pointer hover:brightness-95 transition-all"
            style={baseStyle}
            aria-label={`${label} — open cause`}
          >
            <AlertTriangle className="size-2.5" />
            {label}
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded border cursor-help"
            style={baseStyle}
          >
            <AlertTriangle className="size-2.5" />
            {label}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─────────── Educational banner ───────────
   Mirrors the purple "mid-market" explainer block used in the currencies
   repo's ExchangeRateLibraryPage — soft violet background, 3px left accent,
   tinted icon chip on the left, and a one-line plain-language description
   on the right. Used as the lead row of every Demand tab so users get a
   quick orientation before scanning the table. */

function DemandInfoBanner({
  icon: Icon,
  children,
  rightAction,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  /** Optional inline action rendered on the banner's right side — used
      by the All-Demand listing to surface "Edit filters" as a small
      integrated button instead of a dedicated row above the banner. */
  rightAction?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border-l-[3px] flex items-center gap-3 px-4 py-3"
      style={{ backgroundColor: "#F5F3FF", borderLeftColor: "#7C3AED" }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#EDE9FE" }}
      >
        <Icon className="w-4 h-4" style={{ color: "#7C3AED" }} />
      </div>
      <div
        className="min-w-0 flex-1 text-[12px] leading-snug"
        style={{ color: "#475569", fontFamily: FONT }}
      >
        {children}
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}

/* ─────────── Section header ─────────── */

function SectionHeader({
  icon: Icon,
  title,
  count,
  actions,
}: {
  icon?: React.ElementType;
  title: string;
  count?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
            <Icon className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
          </div>
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: "#334155", fontFamily: FONT }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: FONT }}>· {count}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PER-TABLE TOOLBAR
   Reusable Search + Filters + Insights + Density + Columns bar.
   Mirrors the toolbar shape used on the Purchase Orders table.
   Each consumer table owns its own search / filter / column / density
   state; this component is purely presentational.
   ═══════════════════════════════════════════════════════════════ */

/**
 * A single filter group rendered inside the Filters modal.
 * Shape mirrors POFiltersModal sections — title + optional subtitle + pill chips.
 */
export interface DemandFilterGroup {
  key: string;
  /** Section title shown in the modal (e.g. "Status"). */
  title: string;
  /** Optional muted subtitle below the title. */
  subtitle?: string;
  /** Whether this group accepts multiple simultaneous selections. */
  multi?: boolean;
  /** Show an inline search input when options.length exceeds this number. */
  searchAfter?: number;
  options: Array<{
    value: string;
    label: string;
    count?: number;
    dotColor?: string;
  }>;
  /** Current value — string for single-select, string[] for multi-select. */
  value: string | string[];
  /** Reset target for single-select groups (defaults to "all"). */
  clearValue?: string;
  /** Called when Apply is pressed in the modal. */
  onChange: (value: string | string[]) => void;
}

/** Column descriptor used by the Columns popover. */
export interface DemandColumnDef {
  id: string;
  label: string;
  /** If true, the column cannot be hidden (anchor/sticky cells). */
  alwaysVisible?: boolean;
}

/** Card-grid sizing — mirrors the Partners listing (large = fewer/wider
    cards, small = more/denser cards). Controls grid columns, padding, and
    the item-image size only; card content is identical across sizes. */
type CardSize = "large" | "medium" | "small";

interface DemandTableToolbarProps {
  /** Placeholder for the search input. */
  searchPlaceholder: string;
  search: string;
  onSearchChange: (v: string) => void;

  /** Right-side count text (e.g. "12 of 30 items"). */
  countLabel: string;

  /** Filter groups rendered inside the Filters popover. */
  filterGroups: DemandFilterGroup[];

  /** When provided, the toolbar shows a "Filters" button next to search
      that opens the Plan Inventory modal (matches the PO listing's filter
      button). `filterCount` drives its active-count badge. */
  onOpenFilters?: () => void;
  filterCount?: number;

  /** Density. */
  density: "condensed" | "comfort";
  onDensityChange: (d: "condensed" | "comfort") => void;

  /** Card view (grid of cards) — opt-in per table. When `onCardViewChange`
      is provided, the Views menu gains a "Card View" option plus a size
      control, mirroring the Partners listing. Tables that omit these stay
      table-only (Condensed / Comfort). */
  cardView?: boolean;
  onCardViewChange?: (on: boolean) => void;
  cardSize?: CardSize;
  onCardSizeChange?: (s: CardSize) => void;

  /** Columns — all available + currently hidden. */
  columns: DemandColumnDef[];
  hiddenColumns: Set<string>;
  onColumnToggle: (id: string) => void;

  /** When provided, the Columns control opens the Partners-style side
      drawer (managed by the parent) instead of the inline popover. */
  onOpenColumns?: () => void;
  columnsDrawerOpen?: boolean;

  /** Reset everything (search + filters + columns + density). */
  onReset?: () => void;
}

function ToolbarBadge({
  count,
  active,
}: {
  count: number;
  active?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        fontFamily: FONT,
        backgroundColor: active ? "rgba(10,119,255,0.12)" : "hsl(var(--secondary))",
        color: active ? "#0A77FF" : "hsl(var(--muted-foreground))",
      }}
    >
      {count}
    </span>
  );
}

function DemandTableToolbar({
  searchPlaceholder,
  search,
  onSearchChange,
  countLabel,
  filterGroups,
  onOpenFilters,
  filterCount,
  density,
  onDensityChange,
  cardView,
  onCardViewChange,
  cardSize,
  onCardSizeChange,
  columns,
  hiddenColumns,
  onColumnToggle,
  onOpenColumns,
  columnsDrawerOpen,
  onReset,
}: DemandTableToolbarProps) {
  /* Filters-modal state + adapters retired alongside the Filters
     button. `filterGroups` is still accepted as a prop for back-
     compat with tab branches that haven't been touched, but nothing
     inside the toolbar consumes it now. */
  const [densityOpen, setDensityOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const visibleColumnCount = columns.filter((c) => !hiddenColumns.has(c.id)).length;
  const hiddenColumnsCount = columns.length - visibleColumnCount;
  const densityLabel = density === "condensed" ? "Condensed" : "Comfort";

  return (
    <div className="shrink-0 px-4 py-2.5 border-b border-border bg-card">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* ── Search ── */}
        <div className="relative min-w-[140px] flex-1 xl:max-w-[360px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "hsl(var(--muted-foreground))" }}
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            maxLength={75}
            className="h-9 w-full rounded-md border border-border pl-9 pr-9 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
            style={{
              fontFamily: FONT,
              backgroundColor: "hsl(var(--input-background))",
              color: "hsl(var(--foreground))",
            }}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={() => onSearchChange("")}
              aria-label="Clear"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* ── Filters ── opens the Plan Inventory modal: the single
           filters entry point, sitting next to search like the PO
           listing's Filters button. Active-count badge mirrors it too.
           (`filterGroups` stays an accepted prop for back-compat with
           other tab branches but is no longer rendered as its own
           control.) */}
        {onOpenFilters && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/40 hover:!text-foreground"
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 13,
              ...((filterCount ?? 0) > 0
                ? {
                    borderColor: "hsl(var(--primary))",
                    backgroundColor: "hsl(var(--primary-tint))",
                    color: "hsl(var(--primary))",
                  }
                : {}),
            }}
            onClick={onOpenFilters}
            title="Open filters"
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {(filterCount ?? 0) > 0 && <ToolbarBadge count={filterCount as number} active />}
          </Button>
        )}

        {/* Spacer */}
        <div className="hidden xl:block xl:flex-1" />

        {/* Count text — only shown when the caller passes a non-empty
           `countLabel`. The All Demand listing suppresses this at the
           empty state (params at defaults → table not yet populated)
           so the toolbar reads as quiet chrome until data appears. */}
        {countLabel && (
          <>
            <span
              className="text-sm tabular-nums mr-1 hidden sm:inline shrink-0 whitespace-nowrap"
              style={{
                fontWeight: 500,
                lineHeight: "20px",
                color: "hsl(var(--foreground))",
                fontFamily: FONT,
              }}
            >
              {countLabel}
            </span>
            {/* Separator */}
            <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block shrink-0" />
          </>
        )}

        {/* ── Views popover (density + card view). The amber "condensed"
             dot that used to pin to the top-right was removed per feedback;
             the density label ("Condensed" / "Comfort") already tells the
             buyer their current mode. */}
        <div className="relative shrink-0">
        <Popover open={densityOpen} onOpenChange={setDensityOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/40 hover:!text-foreground"
              style={{ fontFamily: FONT, fontWeight: 500, fontSize: 13 }}
            >
              {cardView ? <LayoutGrid className="size-3.5" /> : <AlignJustify className="size-3.5" />}
              {cardView ? "Card View" : densityLabel}
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[230px] p-1.5" align="end">
            {(
              [
                { mode: "condensed" as const, label: "Condensed", desc: "Compact rows", Icon: AlignJustify, isCard: false },
                { mode: "comfort" as const, label: "Comfort", desc: "Spacious rows", Icon: List, isCard: false },
                /* Card View — only offered when the host wires up the card
                   handlers (the All Demand listing does; other tabs stay
                   table-only). */
                ...(onCardViewChange
                  ? [{ mode: "card" as const, label: "Card View", desc: "Grid layout", Icon: LayoutGrid, isCard: true }]
                  : []),
              ]
            ).map((opt) => {
              const ItemIcon = opt.Icon;
              const isActive = opt.isCard ? !!cardView : !cardView && density === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  className="flex items-center gap-3 w-full py-2.5 px-3 cursor-pointer rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    if (opt.isCard) {
                      // Keep the menu open so the buyer can pick a card size next.
                      onCardViewChange?.(true);
                    } else {
                      onDensityChange(opt.mode as "condensed" | "comfort");
                      onCardViewChange?.(false);
                      setDensityOpen(false);
                    }
                  }}
                >
                  <ItemIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div
                      className="text-sm"
                      style={{ fontWeight: 500, fontFamily: FONT, color: "hsl(var(--foreground))" }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-xs text-muted-foreground" style={{ fontFamily: FONT }}>
                      {opt.desc}
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                </button>
              );
            })}
            {/* Card size — only while card view is active. Mirrors the
               Partners listing's Large / Medium / Small control. */}
            {cardView && onCardSizeChange && (
              <>
                <div className="mx-2 my-1.5 border-t border-muted" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2" style={{ fontWeight: 600, fontFamily: FONT }}>
                    Card Size
                  </p>
                  <div className="flex items-center gap-1.5">
                    {(["large", "medium", "small"] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onCardSizeChange(size)}
                        className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                          cardSize === size
                            ? "bg-primary text-white shadow-sm"
                            : "bg-muted text-slate-500 hover:bg-border"
                        }`}
                        style={{ fontWeight: cardSize === size ? 600 : 500, fontFamily: FONT }}
                      >
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
        </div>

        {/* ── Columns control — Partners-style side drawer when the
            parent provides an opener; inline popover fallback otherwise.
            The amber "columns hidden" dot was removed per feedback; the
            trigger's own "N columns" count carries that info already. */}
        <div className="relative shrink-0">
        {onOpenColumns ? (
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnsDrawerOpen}
            disabled={!!cardView}
            onClick={onOpenColumns}
          />
        ) : (
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/40 hover:!text-foreground"
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: 13,
                ...(columnsOpen
                  ? {
                      borderColor: "#0A77FF",
                      backgroundColor: "rgba(10,119,255,0.06)",
                      color: "#0A77FF",
                    }
                  : {}),
              }}
            >
              <Columns3 className="size-3.5 text-muted-foreground/80" />
              Columns
              <ToolbarBadge count={visibleColumnCount} active />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-3" align="end">
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="text-[12px] uppercase tracking-wide"
                style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.05em", fontFamily: FONT }}
              >
                Columns
              </span>
              <span
                className="text-[11px]"
                style={{ color: "#64748B", fontFamily: FONT, fontWeight: 500 }}
              >
                {visibleColumnCount} of {columns.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto">
              {columns.map((col) => {
                const isHidden = hiddenColumns.has(col.id);
                const isLocked = col.alwaysVisible;
                return (
                  <button
                    key={col.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && onColumnToggle(col.id)}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors text-left ${
                      isLocked
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className="text-[13px] truncate"
                      style={{
                        fontWeight: 500,
                        color: isHidden ? "#94A3B8" : "#0F172A",
                        fontFamily: FONT,
                      }}
                    >
                      {col.label}
                      {isLocked && (
                        <span
                          className="ml-1.5 text-[10px] uppercase"
                          style={{ color: "#94A3B8", fontWeight: 600, letterSpacing: "0.05em" }}
                        >
                          locked
                        </span>
                      )}
                    </span>
                    {isHidden ? (
                      <EyeOff className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: "#0A77FF" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        )}
        </div>

        {/* Reset/refresh icon button removed per request — the density (Views)
           and Columns controls remain. `onReset` is still accepted for
           back-compat with other tab branches but is no longer surfaced here. */}
      </div>
    </div>
  );
}

/* ── Column registries per Demands table ───────────────────── */

/* All Demand columns — Partners-style rich row, left to right:
   Item (identity, sticky) · Description · GAP (the deficit) · ATP
   (available now) · Sources (clickable SO / PR document links) ·
   Issues (the stocking-level band) · Need by (earliest document date) ·
   Owner (avatar + name). Priority was removed entirely: the system
   does not rank importance, the manager
   decides. The default sort still groups rows by category even though
   that column isn't shown. Every header is click-to-sort; the Columns
   menu hides any of the non-anchor columns. */
const ALL_DEMAND_COLUMNS: DemandColumnDef[] = [
  { id: "item", label: "Item", alwaysVisible: true },
  { id: "description", label: "Description" },
  { id: "gapIssue", label: "Issues" },
  { id: "currentAtp", label: "Available to promise" },
  { id: "sources", label: "Sources" },
  { id: "needBy", label: "Need by" },
  { id: "owner", label: "Purchasing Owner" },
  { id: "acquisition", label: "Acquisition" },
  { id: "actions", label: "Actions", alwaysVisible: true },
];

const SALES_ORDERS_COLUMNS: DemandColumnDef[] = [
  { id: "soNumber", label: "Sales Order", alwaysVisible: true },
  { id: "customer", label: "Customer" },
  { id: "dueDate", label: "Due Date" },
  { id: "itemCount", label: "Items" },
  { id: "gaps", label: "Gaps", alwaysVisible: true },
];

const REQUEST_COLUMNS: DemandColumnDef[] = [
  { id: "requester", label: "Requester", alwaysVisible: true },
  { id: "item", label: "Item", alwaysVisible: true },
  { id: "description", label: "Description" },
  { id: "qty", label: "Qty" },
  { id: "reason", label: "Reason" },
  { id: "submitted", label: "Submitted" },
  { id: "neededBy", label: "Need by" },
  { id: "urgency", label: "Urgency" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions", alwaysVisible: true },
];

const LOW_STOCK_COLUMNS: DemandColumnDef[] = [
  { id: "item", label: "Item", alwaysVisible: true },
  { id: "description", label: "Description" },
  { id: "currentStock", label: "Current Stock" },
  { id: "reorderPoint", label: "Minimum Order Quantity" },
  { id: "gap", label: "Gap" },
  { id: "vendor", label: "Preferred Vendor" },
  { id: "actions", label: "Action", alwaysVisible: true },
];

/* Same column set as the Purchase Orders table, plus a single extra
   "Days Stale" column. Order kept identical so the two surfaces feel
   like the same table with one additional signal. */
const STALE_PO_COLUMNS: DemandColumnDef[] = [
  { id: "poNumber", label: "PO No", alwaysVisible: true },
  { id: "vendor", label: "Partner Location" },
  { id: "status", label: "Status" },
  { id: "orderedItems", label: "Ordered Item(s)" },
  { id: "pointOfContact", label: "Point of Contact" },
  { id: "location", label: "Location" },
  { id: "createdBy", label: "Created By" },
  { id: "dueDeliveryDate", label: "Due Delivery Date" },
  { id: "orderDate", label: "Order Date" },
  { id: "daysStale", label: "Days Stale" },
  { id: "actions", label: "Action", alwaysVisible: true },
];

/* ─────────── Props ─────────── */

export interface PODemandsProps {
  /** Stale POs carry the same columns as the Purchase Orders table —
      partner location, status, ordered items, point of contact, etc. The
      only extra column is `daysStale`. Optional fields render as "—" when
      missing so we never block display on incomplete data. */
  stalePOs: Array<{
    id: string;
    poNumber: string;
    version?: number;
    vendor: string;
    vendorAbbr?: string;
    status: "Draft" | "Sent";
    total: number;
    orderDate: string;
    daysStale: number;
    /** PO-table parity fields — optional so legacy callsites still compile. */
    orderedItems?: Array<{ code: string; image: string }>;
    pointOfContact?: string;
    pointOfContactAbbr?: string;
    location?: string;
    locationAddress?: string;
    createdBy?: string;
    dueDeliveryDate?: string;
  }>;
  onNavigatePO: (id: string) => void;
  /** Legacy entrypoint — opens the catalogue modal. Still used by Stale POs,
      Purchase Requests, Sales Orders inner table and per-source CTAs. */
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
  /** Main All-Demand row CTA — completes OrderFlow → creates a Draft PO
      directly (buy-now pattern) and navigates to it. */
  onConfirmDraftPO?: (result: OrderFlowResult) => void;
  /** "Plan in Sandbox" handoff — switches the top tab to Procurement
      Planner and pre-loads the item into the Sandbox workbench. Lets the
      buyer design a multi-vendor fix with the live ATP curve when a
      single-vendor "+ Create PO" isn't enough. */
  onPlanInSandbox?: (itemCode: string) => void;
  /** Broadcasts whether the buyer has applied a scope (i.e. left the FTU
      questionnaire and revealed the table). Parents listen so the top page
      header can hide surfaces that don't belong on the FTU landing — the
      Open sandbox CTA in particular. Called on mount + whenever the flag
      flips. Optional; no-op when omitted. */
  onScopeAppliedChange?: (applied: boolean) => void;
}

export function getDemandsCounts() {
  return {
    demandItems: MOCK_DEMAND_ITEMS.length,
    requests: INITIAL_REQUESTS.length,
    pendingRequests: INITIAL_REQUESTS.filter((r) => r.status === "Pending").length,
  };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

/* Scope-modal gate that survives in-app navigation but resets on a hard
   refresh. Module-level (re-evaluated only on a full page load), so the
   first-run filter modal shows once per page load — not again when the buyer
   returns from the Sandbox or toggles tabs within the same session. */
let scopeShownThisLoad = false;

/* Whether the buyer has APPLIED the scope this page load (pressed "Show my
   demand" / closed the first-run modal). The listing loads the demand on
   apply — even with the defaults (all sources, next 30 days) — instead of
   staying empty until a narrowing filter is set. Module-level so it survives
   in-app navigation (Sandbox → Back) and resets on a hard refresh, mirroring
   `scopeShownThisLoad`. */
let scopeAppliedThisLoad = false;

/* Bulk multi-select (the sticky-left checkbox column + the "N selected" bulk
   action strip) lets the buyer tick several items and add them ALL to the
   sandbox in one action via `bulkPlanInSandbox`. It is ON for BOTH the
   first-time and recurring journeys — mode-independent, and the per-row
   Sandbox CTA still works alongside it. Flip to `false` to force the
   single-item-only flow. */
const SHOW_BULK_MULTISELECT = true;

/* The "Resume sandbox" strip was REMOVED (2026-06-23). Resume is handled
   solely by the persistent top-right "Sandbox (N)" button in DemandTableToolbar
   — shown for BOTH journeys whenever the session has items — so the banner (and
   its SHOW_RESUME_SANDBOX flag) are gone; they only duplicated the button. */

/* In-plan items STAY in the listing, tagged with an "In plan" pill and an
   "Enter Sandbox" CTA, so a buyer can always see which items are already in
   their sandbox (Nophil: "I don't know which ones are already in the sandbox").
   This REVERSES the earlier first-time-minimalism rule that hid them. Flip to
   `true` to filter them out of the results for every filter combination. */
const HIDE_IN_PLAN_ITEMS = false;

export default function PODemands({ stalePOs, onNavigatePO, onCreatePO, onConfirmDraftPO, onPlanInSandbox, onScopeAppliedChange }: PODemandsProps) {
  const [demandItems] = useState<DemandItem[]>(MOCK_DEMAND_ITEMS);
  const [requests, setRequests] = useState<PurchaseRequest[]>(INITIAL_REQUESTS);

  /* Self-heal: in dev, Vite HMR can preserve component state across hot
     reloads, so if we later add a field (like `neededBy`) to the mock
     data, the React state still holds the old shape and the new cells
     render blank. Whenever the source mock-data list grows a field that
     a current state row is missing, we re-seed that row from the latest
     INITIAL_REQUESTS entry of the same id. Runs once on mount. */
  useEffect(() => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.neededBy) return r;
        const fresh = INITIAL_REQUESTS.find((x) => x.id === r.id);
        return fresh ? { ...fresh, ...r, neededBy: fresh.neededBy } : r;
      }),
    );
  }, []);

  /* Inner tab switcher — drives which table renders below the summary widgets.
     "all" is the cross-source aggregated view; the others drill into a single source. */
  type DemandsTabKey = "all" | "sales-orders" | "requests" | "low-stock" | "stale";
  const [activeDemandsTab, setActiveDemandsTab] = useState<DemandsTabKey>("all");
  // If the Low Stock sub-tab is hidden but state still points at it (e.g.,
  // preserved across HMR or restored from URL), fall back to "all".
  useEffect(() => {
    if (!SHOW_LOW_STOCK_SUBTAB && activeDemandsTab === "low-stock") {
      setActiveDemandsTab("all");
    }
  }, [activeDemandsTab]);

  /* "+ Add item" tab — a browser-chrome-style pinned trigger at the end of
     the tab strip. Click doesn't switch to a tab; it opens the shared
     PlannerManageItemsModal so the buyer can pull additional items into
     their planning scope (params.items). */
  const [manageItemsOpen, setManageItemsOpen] = useState(false);
  const plannerItemUniverse = useMemo<PlannerInventoryItem[]>(
    () =>
      PLANNER_ITEMS.map((i) => ({
        code: i.itemCode,
        name: i.itemName,
        category: i.category,
        ownedByMe: i.ownedByMe,
        image: i.itemImage,
        onHand: i.onHand,
        unit: i.baseUom,
        vendor: i.primaryVendor,
      })),
    [],
  );

  /* Global search + filters */
  const [globalSearch, setGlobalSearch] = useState("");
  const [filterUrgency, setFilterUrgency] = useState<"all" | Urgency>("all");
  /* The legacy `filterSourceKind` quick-filter (single-select for
     SO/Request/LowStock) was retired in favour of the working
     filter set wired to `params.sources` (multi-select). The
     toolbar's Demand Source filter now drives the canonical scope
     value via `handleScopeRefine`. */
  /* Severity filter retired — E3 directive ("severity is parked")
     completed. The state, the toolbar filter group, the active-filters
     chip and the table column are all gone. The Sandbox still uses
     severity internally where it drives the planning gate. */
  /* The old `causeItemCode` (Cause modal) and `detailItemId` (Demand
     Item Detail modal) state has been retired. The Sandbox is now the
     single landing surface: clicking *any* row interaction (item code,
     severity pill, the Plan icon button) routes to `onPlanInSandbox`,
     which mounts `PlannerSandboxModal` on the host page. The Sandbox
     carries the chart + transactions + item details + planning
     workspace, so the read-only views (Cause / Item Detail) became
     redundant. */

  /* ── Procurement Planning parameters ───────────────────────────
     The tab lands directly on the All Demand listing — there's no
     intermediate entry / scope-builder surface anymore. `params` is
     the single source of truth for the scope (time horizon · demand
     sources · categories · min/max levels · need by); it persists
     across visits so the buyer's last scope is restored. The inline
     filter bar at the top of the table card is the only scope
     control — refinements flow through `handleScopeRefine`. */
  const [params, setParams] = useState<ProcurementPlanningParams>(() => {
    /* Dev "recurring user" mode restores the saved scope directly on every
       load (the returning-user path) — reachable only through the dev widget. */
    if (getPlannerUserMode() === "recurring") return loadParams() ?? DEFAULT_PARAMS;
    /* First-time (default): the FTU landing is now the table itself, loaded
       with DEFAULT_PARAMS (categories I own + me as owner + mineOnly + 30d).
       No inline questionnaire wall — buyers refine via the scope bar chips
       or the "Configure filters" modal. Within the same load, remounts
       (tab toggles, Sandbox → Back) restore whatever scope has been applied. */
    return scopeShownThisLoad ? (loadParams() ?? DEFAULT_PARAMS) : DEFAULT_PARAMS;
  });
  /* `hasActiveScope` = the buyer has NARROWED beyond the defaults (a specific
     source / category / issue / non-default window). It now drives the
     "showing the default view" guidance hint — NOT the data gate. */
  const hasActiveScope = !paramsEqual(params, DEFAULT_PARAMS);
  /* The listing always renders on entry now — Eli 2026-07-31: the
     inline FTU questionnaire (scope wall) was parked to the backlog;
     both first-time and recurring users land straight on the table
     with sensible defaults (or their last saved scope in recurring
     mode). The questionnaire code stays in the tree behind the
     unreachable `!scopeApplied` branch, in case we bring it back
     later — but nothing surfaces it today. */
  const [scopeApplied, setScopeApplied] = useState(true);
  useEffect(() => {
    scopeAppliedThisLoad = true;
  }, []);
  /* Default-view guidance hint — dismissible; shown once the listing is live
     but no narrowing filter is set yet (#4 "guide the user"). */
  const [defaultHintDismissed, setDefaultHintDismissed] = useState(false);
  /* "More filters" modal. The first-run scope surface is now the inline hero
     header (PlannerScopeBar variant="hero") at the top of the listing card —
     NOT a modal. This Dialog is kept purely as the guided "More filters" /
     toolbar Filters surface (the reopen path), so it starts CLOSED and only
     opens on demand. */
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  useEffect(() => {
    /* First-time (default): fresh page load → clear any persisted scope so a
       remount this load also starts clean until the buyer applies filters.
       Recurring (dev) mode preserves the saved scope. Then mark the gate
       "seen" so returning to the listing (Sandbox → Back, tab toggles) never
       re-pops the modal. A hard refresh resets the module flag and re-arms. */
    if (getPlannerUserMode() !== "recurring" && !scopeShownThisLoad) saveParams(DEFAULT_PARAMS);
    scopeShownThisLoad = true;
  }, []);
  /* Publish FTU vs applied state to the parent so it can hide the top-of-
     page "Open sandbox" CTA on the FTU questionnaire (nothing to plan yet
     until the buyer commits a scope and sees the table). Fires on mount so
     the parent's initial paint already reflects the correct state. */
  useEffect(() => {
    onScopeAppliedChange?.(scopeApplied);
  }, [scopeApplied, onScopeAppliedChange]);
  /* Recommend POs modal — opens the batch surface that materialises
     the buildRecommendations engine across every in-scope item. State
     is just an open flag because the modal reads its inputs (in-scope
     items + recommendations + projection horizon) directly from the
     host's existing derived data. */
  const [recommendModalOpen, setRecommendModalOpen] = useState<boolean>(false);
  /** Single named saved view — the entry surface's "name your search"
      affordance. `null` until the buyer saves one. */
  /* The savedView mechanism (a single named slot stored alongside the
     params set) was driven from the retired entry surface. It's left
     in `procurementPlanningParams.ts` for any future inline-bar
     extension that wants to expose it, but the host no longer
     surfaces it. */

  /** Days of forward look-ahead for the projection. Driven by the
      parameter set so the time-period chip in the entry surface
      actually changes the projection horizon (and downstream
      severity / first-violation reads). */
  const PROJECTION_HORIZON_DAYS = params.horizonDays;

  /* Subscribe to the PO store so the projection map recomputes whenever
     POs are created / sent / received (Future Incoming feeds into ATP). */
  const [purchaseOrdersForProjection, setPurchaseOrdersForProjection] = useState(() => getAllPOs());
  useEffect(() => {
    setPurchaseOrdersForProjection(getAllPOs());
    return subscribeToPOStore(() => setPurchaseOrdersForProjection(getAllPOs()));
  }, []);

  /* (Cart-store subscription + sandbox-parked badge were retired
     alongside the duplicate cart button — the global page header
     already exposes a cart entry point, so a second copy on this
     surface was just noise. The same cart store still drives the
     Sandbox modal's Save-to-cart flow; PODemands itself no longer
     needs to read it.) */

  /* Projection map — itemCode → worst-severity + first-violation date +
     day-0 Current ATP + base UoM, all inside the 30-day horizon. Built by
     cross-referencing demand-item codes against the planner's full item
     registry (PLANNER_ITEMS holds min/max/MOQ/etc that ATP projection
     needs). Items without a matching planner record return undefined and
     render "—" in the dependent columns. Powers:
       · ProjectionPill (severity + first-violation date)
       · "Future stockout" chip filter
       · Severity column
       · First Violation column
       · Current ATP column (with UoM) */
  interface DemandProjection {
    worstSeverity: PlannerSeverity;
    firstViolation: string | null;
    currentAtp: number;
    baseUom: string;
  }
  const projectionByItemCode = useMemo<Map<string, DemandProjection>>(() => {
    const out = new Map<string, DemandProjection>();
    for (const item of PLANNER_ITEMS) {
      const events = PLANNER_DEMAND_EVENTS.filter((e) => e.itemCode === item.itemCode);
      const incoming = getFutureIncomingForItem(item.itemCode, purchaseOrdersForProjection);
      const curve = projectAtpCurve(item, events, incoming, PROJECTION_HORIZON_DAYS);
      out.set(item.itemCode, {
        worstSeverity: worstSeverityInHorizon(curve, item.minLevel),
        firstViolation: firstViolationDate(curve, item.minLevel),
        currentAtp: currentAtpOfCurve(curve),
        baseUom: item.baseUom,
      });
    }
    return out;
  }, [purchaseOrdersForProjection, PROJECTION_HORIZON_DAYS]);

  /* Band map — itemCode → stocking-level severity band (or null when
     healthy / no planner record). Joins the projection's day-0 ATP
     against the planner item's min / max levels. Drives the band
     filter chips, the default severity sort, and the Issues column. */
  const bandByItemCode = useMemo<Map<string, LevelBand | null>>(() => {
    const out = new Map<string, LevelBand | null>();
    for (const item of PLANNER_ITEMS) {
      const proj = projectionByItemCode.get(item.itemCode);
      if (!proj) continue;
      out.set(
        item.itemCode,
        bandForAtp(proj.currentAtp, item.minLevel, item.maxLevel),
      );
    }
    return out;
  }, [projectionByItemCode]);

  /* Recommendation map — itemCode → { totalQty, recommendations[],
     conflicts[], baseUom, item }. Built by running the shared Phase 6
     engine (`buildRecommendations`) on every planner item against
     today's live demand + future incoming. Powers two surfaces:

       1. The "Recommended order qty" column on the All-Demand table —
          decision-support: the buyer sees the per-row total before
          committing, computed with the same math the one-button
          generate uses (Eli E11 fidelity note).
       2. The "Recommend POs" modal — materialises every vendor-level
          recommendation across the in-scope items into editable
          drafts, surfacing the same conflicts inline.

     Items not in the planner registry render no recommendation —
     buildRecommendations only runs on PLANNER_ITEMS. */
  interface ItemRecommendation {
    item: PlannerItem;
    recommendations: Recommendation[];
    conflicts: RecommendationConflict[];
    /** Sum of every recommendation's qty, in the item's `baseUom`. */
    totalQty: number;
  }
  const recommendationByItemCode = useMemo<Map<string, ItemRecommendation>>(() => {
    const out = new Map<string, ItemRecommendation>();
    for (const item of PLANNER_ITEMS) {
      const events = PLANNER_DEMAND_EVENTS.filter((e) => e.itemCode === item.itemCode);
      const incoming = getFutureIncomingForItem(item.itemCode, purchaseOrdersForProjection);
      const { recommendations, conflicts } = buildRecommendations(
        item,
        events,
        incoming,
        PROJECTION_HORIZON_DAYS,
      );
      const totalQty = recommendations.reduce((sum, r) => sum + r.qty, 0);
      out.set(item.itemCode, { item, recommendations, conflicts, totalQty });
    }
    return out;
  }, [purchaseOrdersForProjection, PROJECTION_HORIZON_DAYS]);

  /* Owner / ownership map — itemCode → { owner: string, ownedByMe: boolean }.
     Cross-references the same `PLANNER_ITEMS` registry the projection map
     uses. Powers two surfaces: the new Owner column on the All-Demand table
     (avatar + name) and the Me/All filter toggle in the toolbar. Items
     without a matching planner record return undefined — those rows show
     "—" in the Owner column and are excluded by Me mode (no owner attached,
     can't claim ownership). */
  const ownerByItemCode = useMemo<Map<string, { owner: string; ownedByMe: boolean }>>(() => {
    const out = new Map<string, { owner: string; ownedByMe: boolean }>();
    for (const item of PLANNER_ITEMS) {
      out.set(item.itemCode, { owner: item.purchasingOwner, ownedByMe: item.ownedByMe });
    }
    return out;
  }, []);

  /* Acquisition method per item — synthesized (Purchased / Manufactured, with
     an optional secondary make-or-buy method). Drives the Acquisition column
     + the toolbar Acquisition filter (#6 / #22). */
  const acquisitionByItemCode = useMemo<Map<string, ItemAcquisition>>(() => {
    const out = new Map<string, ItemAcquisition>();
    for (const item of PLANNER_ITEMS) out.set(item.itemCode, getAcquisitionForItem(item));
    return out;
  }, []);

  /* Owner + acquisition filters moved INTO the persisted scope
     (`params.purchasingOwners` / `params.acquisitionMethods`) so the Plan
     Inventory modal and the toolbar dropdowns share one source of truth
     (Eli feedback). Empty arrays = all. They were toolbar-only local
     state before — see procurementPlanningParams.ts. */

  /* Standalone "Configure categories" modal — opened from the scope-bar
     category dropdown (Nophil/Eli #3); its own instance so it's reachable
     from the listing without going through the first-run questionnaire. */
  const [catConfigureOpen, setCatConfigureOpen] = useState(false);
  /* Row-click transaction ledger drawer (E2) — the clicked item's PlannerItem,
     or null when closed. */
  const [txnItem, setTxnItem] = useState<PlannerItem | null>(null);
  /* Per-item ledger data for the drawer. Read-only: store + seeded supply and
     the item's demand events (no sandbox what-ifs / vendor plotting — the full
     planning surface stays in the Sandbox). Recomputed only when the item changes. */
  const txnDrawerData = useMemo(() => {
    if (!txnItem) return null;
    const pos = getAllPOs();
    const poByNumber = new Map<string, PurchaseOrderData>();
    for (const po of pos) poByNumber.set(po.poNumber, po);
    const incomingEvents = [
      ...getFutureIncomingForItem(txnItem.itemCode, pos),
      ...getSeededIncomingForItem(txnItem),
    ].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    /* Draft POs for the row's Draft-POs toggle (req #10) — store drafts +
       one seeded sample, so the toggle has something to reveal. */
    const draftIncoming = [
      ...getDraftPOsForItem(txnItem.itemCode, pos),
      ...getSeededDraftPOForItem(txnItem),
    ].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    return { poByNumber, demandEvents: getDemandEventsForItem(txnItem), incomingEvents, draftIncoming };
  }, [txnItem]);

  /* Sorted unique owners list — drives the toolbar Owner dropdown and
     the FilterPanel Owner group. Pulled from the same `ownerByItemCode`
     map the row Owner cell uses so the dropdown only ever contains
     real owners that the listing can actually filter to. */
  const uniqueOwners = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const v of ownerByItemCode.values()) set.add(v.owner);
    return Array.from(set).sort();
  }, [ownerByItemCode]);

  /* Who counts as "me" — used to mark the buyer's own name in the
     Owner dropdown with a "You" badge. Pulled from any owner record
     where `ownedByMe === true`. */
  const myOwnerName = useMemo<string | null>(() => {
    for (const v of ownerByItemCode.values()) {
      if (v.ownedByMe) return v.owner;
    }
    return null;
  }, [ownerByItemCode]);

  /* Category lookup per item, sourced from the planner registry.
     Drives the entry-time Categories multi-select and the filter
     pipeline below. Items absent from the planner registry have no
     category (filtered out when categories is non-empty). */
  const categoryByItemCode = useMemo<Map<string, string>>(() => {
    const out = new Map<string, string>();
    for (const item of PLANNER_ITEMS) {
      if (item.category) out.set(item.itemCode, item.category);
    }
    return out;
  }, []);

  /* Sorted unique category list — drives the entry-time Categories
     picker. Empty entries are filtered out so the picker doesn't
     surface blank options. */
  const uniqueCategories = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const v of categoryByItemCode.values()) set.add(v);
    return Array.from(set).sort();
  }, [categoryByItemCode]);

  /* Categories surface as ERP-style codes (C-2131, C-2132, …) rather than
     names — assigned stably across the sorted category list. The underlying
     filter value stays the category name, so filtering / counts / sorting are
     unaffected; only the displayed label becomes the code. */
  const categoryCodeByName = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    uniqueCategories.forEach((c, i) => {
      out[c] = `C-${2131 + i}`;
    });
    return out;
  }, [uniqueCategories]);

  /* Item list for the entry modal's item picker — code + name + category
     + ownership, so the picker can fuzzy-search by code/name and the
     "mine" lens can narrow to the buyer's owned items + categories
     (Nophil: item-level filters / items I own / categories I own). */
  const planningItemsList = useMemo(
    () =>
      demandItems.map((i) => ({
        code: i.itemCode,
        name: i.itemName,
        category: categoryByItemCode.get(i.itemCode) ?? "",
        ownedByMe: ownerByItemCode.get(i.itemCode)?.ownedByMe ?? false,
        image: i.itemImage,
        /* Carried through for the Manage Items modal's table columns
           (On-Hand Qty, Stocking Unit, vendor). Real demand-item data
           so the ported Partners modal shows the planner's own items. */
        onHand: i.currentStock,
        unit: i.uom,
        vendor: i.preferredVendor,
      })),
    [demandItems, categoryByItemCode, ownerByItemCode],
  );

  /* Faceted counts for the Scope Rail — absolute facet sizes over the
     full demand set, so the numbers stay stable as the buyer toggles
     other dimensions. They show the shape of the data and guide
     first-time buyers. */
  const scopeSourceCounts = useMemo<Record<DemandSourceKind, number>>(() => {
    const out: Record<DemandSourceKind, number> = { SO: 0, Request: 0, LowStock: 0 };
    for (const item of demandItems) {
      for (const kind of new Set(item.sources.map((s) => s.kind))) out[kind] += 1;
    }
    return out;
  }, [demandItems]);
  const scopeCategoryCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const item of demandItems) {
      const cat = categoryByItemCode.get(item.itemCode);
      if (cat) out[cat] = (out[cat] ?? 0) + 1;
    }
    return out;
  }, [demandItems, categoryByItemCode]);
  const scopeBandCounts = useMemo<Record<LevelBand, number>>(() => {
    const out: Record<LevelBand, number> = {
      "below-zero": 0,
      "below-min": 0,
      "above-max": 0,
      "below-max": 0,
    };
    for (const b of bandByItemCode.values()) {
      if (b) out[b] += 1;
    }
    return out;
  }, [bandByItemCode]);
  /* Owner picker options for the Plan Inventory modal — same shape the
     toolbar Owner dropdown uses (name, "You" flag, faceted count over the
     scoped demand set). Owner + acquisition are now scope dimensions
     (params), so the modal needs these to render its pickers. */
  const scopeOwnerOptions = useMemo(
    () =>
      uniqueOwners.map((name) => ({
        value: name,
        label: name,
        isMe: myOwnerName != null && name === myOwnerName,
        count: demandItems.filter((i) => ownerByItemCode.get(i.itemCode)?.owner === name).length,
      })),
    [uniqueOwners, myOwnerName, demandItems, ownerByItemCode],
  );
  const scopeAcquisitionCounts = useMemo<Record<string, number>>(() => {
    const tally = (m: string) =>
      demandItems.filter((i) => {
        const acq = acquisitionByItemCode.get(i.itemCode);
        return !!acq && (acq.primary === m || acq.secondary === m);
      }).length;
    return { Purchased: tally("Purchased"), Manufactured: tally("Manufactured") };
  }, [demandItems, acquisitionByItemCode]);
  /* Count of active scope dimensions — drives the toolbar "Filters" button
     badge (mirrors the PO listing's activeFilterCount). Same dimensions the
     questionnaire counts, read off the committed params. */
  const activeScopeFilterCount = useMemo(() => {
    const p = params;
    return (
      (p.customEnd || p.horizonDays !== DEFAULT_PARAMS.horizonDays ? 1 : 0) +
      (p.mineOnly ? 1 : 0) +
      (p.sources.length > 0 ? 1 : 0) +
      (p.categories.length > 0 ? 1 : 0) +
      (p.items.length > 0 ? 1 : 0) +
      (p.purchasingOwners.length > 0 ? 1 : 0) +
      (p.acquisitionMethods.length > 0 ? 1 : 0) +
      (p.bands.length > 0 ? 1 : 0)
    );
  }, [params]);

  const navigate = useNavigate();

  /* Selection for bulk actions */
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  /* Open sandbox-session items — drives the bulk button's create-vs-add copy
     so it shares the sandbox naming vocabulary (Create / Add to Sandbox). */
  const openSandboxItems = useOpenPlannerItems();
  /* Most-recent item the buyer was planning on. Only counts when it's still
     part of the open session — a closed tab shouldn't offer a jump-back. */
  const lastActiveItemCode = useLastActiveItem();
  const lastActiveItemInSession =
    lastActiveItemCode && openSandboxItems.includes(lastActiveItemCode)
      ? lastActiveItemCode
      : null;
  /* Dev journey mode (first-time | recurring). Drives the render-time gates
     below (resume banner, in-plan filtering) live; the load-time gates
     (scope modal, params) read it in their initializers above. */
  const userMode = usePlannerUserMode();
  /* Multi-PO confirmation modal — mirrors CartPage.tsx multi-vendor
     checkout. Opens when bulk Create POs splits selected demand items
     across more than one vendor; lists the created POs with a checklist
     so the buyer can jump straight into the ones they want to review. */
  /* The modal now operates as a PRE-creation preview: bulkCreatePOs
     builds a per-vendor plan, opens the modal, and creation only runs
     when the buyer confirms with the Create POs button below. Each
     preview entry carries the line-item array we'll pass to
     createPOFromVendorCheckout so confirmation is just a forEach over
     the checked plans. */
  type POPreview = {
    key: string;
    vendor: string;
    total: number;
    itemCount: number;
    lineItems: Array<{
      id: string;
      itemNumber: string;
      descriptiveName: string;
      image: string;
      unitPrice: number;
      vendorQty: number;
      vendorUOM: string;
      vendorUOMQty: number;
      quantity: number;
      defaultUOM: string;
      discount: number;
      shipmentMethod: string;
      dueDeliveryDate: string;
      inboundLocation: string;
      category: string;
    }>;
  };
  const [multiPOModal, setMultiPOModal] = useState<{ previews: POPreview[] } | null>(null);
  const [multiPOChecked, setMultiPOChecked] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  /* Header select-all — adds or removes every id on the current page
     (Partners-directory semantics: the checkbox acts on the visible page,
     not the entire filtered set). */
  const toggleSelectMany = (ids: string[], select: boolean) =>
    setSelectedItems((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });

  /* By Source collapsibles */
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set(["so-1"]));
  const toggleSO = (id: string) =>
    setExpandedSOs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Pagination */
  const [demandPage, setDemandPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  /* Records per page — drives the pagination footer. Sentinel `-1`
     means "All rows on one page" (buyer ask 2026-07-16: 20 / 50 /
     100 / All, with All always present). The slice math below reads
     this via PAGE_SIZE, which resolves the sentinel to a safe upper
     bound so `Math.ceil(N / PAGE_SIZE)` still yields 1 page. */
  const [pageSize, setPageSize] = useState<number>(20);
  const PAGE_SIZE = pageSize > 0 ? pageSize : Number.MAX_SAFE_INTEGER;

  /* Requests sub-filter */
  /* Same two-state pattern as severity — single-select pill state +
     independent multi-select modal state. */
  const [quickRequestStatus, setQuickRequestStatus] = useState<"all" | RequestStatus>("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatus[]>([]);
  const [requestSearch, setRequestSearch] = useState("");

  /* Sort — default is `priority` so the highest-priority demand always rises to the top */
  /* Sort state. The default ("default") groups by category and orders
     most-severe-first within each — see the comparator. Every other
     key maps 1:1 to a visible column header (per-column sorting); the
     direction toggles on repeat clicks of the same header. There is no
     "priority" sort: the system doesn't rank importance for the
     manager, it only surfaces objective severity bands. */
  type AllDemandSortKey =
    | "default"
    | "item"
    | "description"
    | "gap"
    | "atp"
    | "sources"
    | "issues"
    | "needBy"
    | "owner"
    | "acquisition";
  const [sortBy, setSortBy] = useState<AllDemandSortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  /* Header click → sort by that column. First click on a new column
     sorts ascending; clicking the active column flips direction.
     Picking a column never resets the category grouping fallback —
     ties break on item code. */
  const handleColumnSort = (key: AllDemandSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setDemandPage(1);
  };

  /* Scope gate is derived from the params shape (see `hasActiveScope`
     above): the table shows data ONLY when the buyer has an active scope
     (params ≠ DEFAULT_PARAMS). A first-run questionnaire seeds the scope and
     the inline filter bar refines it; "Clear all" returns to DEFAULT_PARAMS
     and the listing drops back to its empty state — data is never shown
     without filters applied. */

  /* Density toggle — drives row height in each table (ER Library pattern) */
  const [density, setDensity] = useState<"condensed" | "comfort">("condensed");

  /* ── Per-table toolbar state ────────────────────────────
     Each table owns its own search, filter, hidden-columns, density,
     and active-insights so the toolbar behaves independently per tab. */

  /* All Demand tab */
  /* "Need by" is hidden by default — it's a secondary signal next to Issues /
     Gap / ATP. It stays registered in ALL_DEMAND_COLUMNS, so users can switch
     it back on from the Columns drawer at any time. */
  const [allHiddenCols, setAllHiddenCols] = useState<Set<string>>(() => new Set(["needBy"]));
  /* Column order + drawer-open state for the Partners-style column
     side drawer (replaces the old inline Columns popover). */
  const [allColumnOrder, setAllColumnOrder] = useState<string[]>(() =>
    ALL_DEMAND_COLUMNS.map((c) => c.id),
  );
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [allDensity, setAllDensity] = useState<"condensed" | "comfort">("condensed");
  /* Card view for the All Demand (Procurement Planning) listing — the
     Partners-style grid of cards. `allCardView` toggles table ↔ cards;
     `allCardSize` drives Large / Medium / Small. Scoped to this listing
     only; the other source tabs stay table-only. */
  const [allCardView, setAllCardView] = useState(false);
  const [allCardSize, setAllCardSize] = useState<CardSize>("medium");

  /* Item Quick View — the same QuickViewPanel item modal the catalogue /
     Parts surfaces use. Clicking an item thumbnail (card or table) opens it,
     pre-filled with that item's code, image, and preferred vendor; the panel
     generates the rest of the detail card internally. */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const openItemQuickView = (item: DemandItem) => {
    setQuickViewData({
      type: "item",
      item: { id: item.itemCode, name: item.itemCode, imageUrl: item.itemImage },
      vendorName: item.preferredVendor || "—",
    });
  };
  const [allVendorFilter, setAllVendorFilter] = useState<string>("all");

  /* Sales Orders tab */
  const [salesSearch, setSalesSearch] = useState("");
  const [salesHiddenCols, setSalesHiddenCols] = useState<Set<string>>(new Set());
  const [salesDensity, setSalesDensity] = useState<"condensed" | "comfort">("condensed");
  const [salesDueFilter, setSalesDueFilter] = useState<string>("all");
  const [salesGapFilter, setSalesGapFilter] = useState<string>("all");

  /* Purchase Requests tab */
  const [requestsHiddenCols, setRequestsHiddenCols] = useState<Set<string>>(new Set());
  const [requestsDensity, setRequestsDensity] = useState<"condensed" | "comfort">("condensed");

  /* Low Stock tab */
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockHiddenCols, setLowStockHiddenCols] = useState<Set<string>>(new Set());
  const [lowStockDensity, setLowStockDensity] = useState<"condensed" | "comfort">("condensed");
  const [lowStockVendorFilter, setLowStockVendorFilter] = useState<string>("all");

  /* Stale POs tab */
  const [staleSearch, setStaleSearch] = useState("");
  const [staleHiddenCols, setStaleHiddenCols] = useState<Set<string>>(new Set());
  const [staleDensity, setStaleDensity] = useState<"condensed" | "comfort">("condensed");
  const [staleStatusFilter, setStaleStatusFilter] = useState<string>("all");

  /* Helper — toggle a string id inside a Set state. */
  const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── OrderFlow state — drives the All-Demand row "+ Create PO" CTA ─── */
  const [orderFlowOpen, setOrderFlowOpen] = useState(false);
  const [orderFlowItem, setOrderFlowItem] = useState<OrderFlowItem | null>(null);
  const [orderFlowDemand, setOrderFlowDemand] = useState<DemandConsolidationContext | undefined>(undefined);

  /** Map a DemandItem → OrderFlowItem for the modal. The aggregated demand
      (totalDemandFor) becomes the default quantity so the buyer sees the
      consolidated number as soon as the modal opens. */
  const buildOrderFlowItem = (item: DemandItem): OrderFlowItem => ({
    id: item.id,
    itemNumber: item.itemCode,
    descriptiveName: item.itemName,
    image: item.itemImage,
    unitPrice: item.unitPrice,
    currentStock: item.currentStock,
    minQuantity: item.reorderPoint ?? 0,
    shortageDate: null,
    partnerLocation: item.preferredVendor,
    category: "General",
    location: "",
    vendorUOM: item.uom,
    vendorUOMQty: 1,
    defaultUOM: item.uom,
    discount: 0,
  });

  /** Build a DemandConsolidationContext from a DemandItem — feeds the banner
      and the "View sources" popover inside the OrderFlow modal. Only real
      demand documents (SO / Request) pass through — Low Stock is an Issue,
      not a source, and `totalQty` (totalDemandFor) already excludes it. */
  const buildDemandContext = (item: DemandItem): DemandConsolidationContext => ({
    sources: demandDocsFor(item).map((s) => ({
      kind: s.kind,
      reference: s.reference,
      qty: s.qty,
      dueDate: s.dueDate,
      reason: s.reason,
      urgency: s.urgency,
    })),
    totalQty: totalDemandFor(item),
    uom: item.uom,
  });

  /** Launch the OrderFlow modal in buy-now mode for the given DemandItem. */
  const openCreatePOForDemand = (item: DemandItem) => {
    setOrderFlowItem(buildOrderFlowItem(item));
    setOrderFlowDemand(buildDemandContext(item));
    setOrderFlowOpen(true);
  };

  /* ─── Single-source PO entry points ───────────────────────
     Each one constructs an OrderFlowItem + a *single-source*
     DemandConsolidationContext so the banner clearly states
     which SO / Request / low-stock item the PO is being created for.

     When the source doesn't carry a preferred vendor (Sales Orders inner
     line items, Purchase Requests), the OrderFlowItem.partnerLocation is
     left empty so the modal's "Add a vendor" empty state triggers — the
     buyer is forced to pick a vendor before they can submit. */

  /** Per-source CTA inside the All-Demand expanded panel.
      Vendor is pre-filled from the parent DemandItem.preferredVendor. */
  const openCreatePOForSource = (item: DemandItem, source: DemandSource) => {
    setOrderFlowItem(buildOrderFlowItem(item));
    setOrderFlowDemand({
      sources: [
        {
          kind: source.kind,
          reference: source.reference,
          qty: source.qty,
          dueDate: source.dueDate,
          reason: source.reason,
          urgency: source.urgency,
        },
      ],
      totalQty: source.qty,
      uom: item.uom,
    });
    setOrderFlowOpen(true);
  };

  /** Sales Orders → SO line-item CTA. No vendor in SO data — the modal
      will prompt the buyer to add one. */
  const openCreatePOForSOLineItem = (
    so: SalesOrder,
    li: SalesOrder["lineItems"][number],
  ) => {
    setOrderFlowItem({
      id: `${so.id}-${li.itemCode}`,
      itemNumber: li.itemCode,
      descriptiveName: li.itemName,
      image: "",
      unitPrice: 0,
      currentStock: li.have,
      minQuantity: 0,
      shortageDate: null,
      partnerLocation: "",
      category: "General",
      location: "",
      vendorUOM: li.uom,
      vendorUOMQty: 1,
      defaultUOM: li.uom,
      discount: 0,
    });
    const gap = Math.max(0, li.need - li.have);
    setOrderFlowDemand({
      sources: [
        {
          kind: "SO",
          reference: so.soNumber,
          qty: gap || li.need,
          dueDate: so.dueDate,
        },
      ],
      totalQty: gap || li.need,
      uom: li.uom,
    });
    setOrderFlowOpen(true);
  };

  /** Purchase Requests → single request CTA. Requests carry no vendor —
      the modal will prompt the buyer to add one. */
  const openCreatePOForRequest = (r: PurchaseRequest) => {
    setOrderFlowItem({
      id: r.id,
      itemNumber: r.itemCode,
      descriptiveName: r.itemName,
      image: r.itemImage,
      unitPrice: 0,
      currentStock: 0,
      minQuantity: 0,
      shortageDate: null,
      partnerLocation: "",
      category: "General",
      location: "",
      vendorUOM: r.uom,
      vendorUOMQty: 1,
      defaultUOM: r.uom,
      discount: 0,
    });
    setOrderFlowDemand({
      sources: [
        {
          kind: "Request",
          reference: r.requesterName,
          qty: r.quantity,
          reason: r.reason,
        },
      ],
      totalQty: r.quantity,
      uom: r.uom,
    });
    setOrderFlowOpen(true);
  };

  /** Low Stock → single item CTA. Vendor is pre-filled from the item's
      preferredVendor; the buyer can still switch via the vendor section. */
  const openCreatePOForLowStockItem = (item: DemandItem) => {
    const need = Math.max(0, (item.reorderPoint ?? 0) - item.currentStock);
    setOrderFlowItem(buildOrderFlowItem(item));
    setOrderFlowDemand({
      sources: [
        {
          kind: "LowStock",
          reference: `Min Order Qty: ${item.reorderPoint ?? 0}`,
          qty: need || (item.reorderPoint ?? 0),
        },
      ],
      totalQty: need || (item.reorderPoint ?? 0),
      uom: item.uom,
    });
    setOrderFlowOpen(true);
  };

  /* In-place scope refinement — the listing's inline filter bar
     (Time horizon · Demand sources · Categories · Min/max levels ·
     Need by) all update params directly via this helper. The params
     slot is the single source of truth and persists across visits.
     Pagination resets to page 1 since a filter change is effectively
     a new view of the dataset. */
  const handleScopeRefine = (next: ProcurementPlanningParams) => {
    setParams(next);
    saveParams(next);
    setDemandPage(1);
  };
  /* Preview count — applies the scope-only filter chain (no toolbar
     refinements like globalSearch / vendor) to the demand-item list so the
     FTU questionnaire can show "N items match" as the buyer picks filters,
     driving the progress indicator toward the real payoff. */
  const computeScopeMatchCount = useCallback((p: ProcurementPlanningParams) => {
    let items = demandItems;
    if (p.purchasingOwners.length > 0) {
      items = items.filter((i) => {
        const own = ownerByItemCode.get(i.itemCode);
        return !!own && p.purchasingOwners.includes(own.owner);
      });
    }
    if (p.acquisitionMethods.length > 0) {
      items = items.filter((i) => {
        const acq = acquisitionByItemCode.get(i.itemCode);
        if (!acq) return false;
        return (
          p.acquisitionMethods.includes(acq.primary) ||
          (acq.secondary != null && p.acquisitionMethods.includes(acq.secondary))
        );
      });
    }
    if (p.sources.length > 0) {
      items = items.filter((i) => i.sources.some((s) => p.sources.includes(s.kind)));
    }
    if (p.categories.length > 0) {
      items = items.filter((i) => {
        const cat = categoryByItemCode.get(i.itemCode);
        return !!cat && p.categories.includes(cat);
      });
    }
    if (p.items.length > 0) {
      items = items.filter((i) => p.items.includes(i.itemCode));
    }
    if (p.mineOnly) {
      items = items.filter((i) => ownerByItemCode.get(i.itemCode)?.ownedByMe === true);
    }
    if (p.bands.length > 0) {
      const thr = p.overstockThreshold ?? null;
      items = items.filter((i) => {
        const band = bandByItemCode.get(i.itemCode);
        if (!band || !p.bands.includes(band)) return false;
        if (band === "above-max" && thr && thr.mode !== "any") {
          const item = PLANNER_ITEMS.find((pi) => pi.itemCode === i.itemCode);
          const atp = projectionByItemCode.get(i.itemCode)?.currentAtp;
          if (!item || atp == null) return false;
          const delta = atp - item.maxLevel;
          if (thr.mode === "pct") {
            const pct = item.maxLevel > 0 ? (delta / item.maxLevel) * 100 : 0;
            if (pct < thr.value) return false;
          } else if (thr.mode === "qty") {
            if (delta < thr.value) return false;
          }
        }
        return true;
      });
    }
    return items.length;
  }, [demandItems, ownerByItemCode, acquisitionByItemCode, categoryByItemCode, bandByItemCode, projectionByItemCode]);
  /* ─── Demands tabs row — rendered as the first row inside every
       table card so the tabs feel like part of the card (Partners pattern).
       Pill-style: active tab gets a blue-tinted fill + blue text; inactive
       tabs are pure text with a hover state. ───────────────────────── */
  /* Feature flags — sub-tabs hidden but their state, data and render
     branches stay intact so we can flip them back on with a one-line
     change. The current Procurement Planning view only exposes All
     Demand + Stale POs; Sales Orders will return once we have a
     workflow that uses them. Purchase Requests are parked from
     procurement (2026-07-20 SHOW_PURCHASE_REQUESTS_IN_PLANNER, shared
     with the graph legend, scope filter and demand data layer). */
  const SHOW_SALES_ORDERS_SUBTAB = false;
  const renderDemandsTabsRow = () => {
    const innerTabs: Array<{ key: DemandsTabKey; label: string; count: number; icon: React.ElementType }> = [
      { key: "all", label: "All Demand", count: demandItems.length, icon: Package },
      ...(SHOW_SALES_ORDERS_SUBTAB
        ? [{ key: "sales-orders" as DemandsTabKey, label: "Sales Orders", count: MOCK_SOS.length, icon: ExternalLink }]
        : []),
      // Low Stock sub-tab — hidden behind SHOW_LOW_STOCK_SUBTAB flag (see top of
      // file). Procurement Planner owns this surface now.
      ...(SHOW_LOW_STOCK_SUBTAB
        ? [{ key: "low-stock" as DemandsTabKey, label: "Low Stock", count: lowStockItems.length, icon: AlertTriangle }]
        : []),
      ...(SHOW_PURCHASE_REQUESTS_IN_PLANNER
        ? [{ key: "requests" as DemandsTabKey, label: "Purchase Requests", count: requests.length, icon: Inbox }]
        : []),
      { key: "stale", label: "Stale POs", count: stalePOs.length, icon: FileWarning },
    ];
    return (
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-white shrink-0 flex-wrap"
        style={{ fontFamily: FONT }}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {innerTabs.map(({ key, label, count, icon: Icon }) => {
            const isActive = activeDemandsTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDemandsTab(key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  /* Tabs muted to a slate treatment so the inline
                     filter bar above stays the page's primary
                     blue control. Active tab uses slate-100 fill +
                     slate-700 text; inactive uses slate-500 text. */
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#334155" : "#64748B",
                  backgroundColor: isActive ? "#F1F5F9" : "transparent",
                  fontFamily: FONT,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#F8FAFC";
                    e.currentTarget.style.color = "#334155";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#64748B";
                  }
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[11px] px-1.5"
                  style={{
                    fontWeight: 600,
                    backgroundColor: isActive ? "#E2E8F0" : "hsl(var(--muted))",
                    color: isActive ? "#334155" : "hsl(var(--muted-foreground))",
                    fontFamily: FONT,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {/* Browser-chrome-style '+' tab — pinned at the end. Doesn't
              switch the active tab; opens PlannerManageItemsModal so the
              buyer can add items to their planning scope. */}
          <button
            type="button"
            onClick={() => setManageItemsOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer shrink-0 ml-0.5"
            style={{
              color: "#64748B",
              backgroundColor: "transparent",
              fontFamily: FONT,
            }}
            title="Add items to your planning scope"
            aria-label="Add items"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F8FAFC";
              e.currentTarget.style.color = "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#64748B";
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  /** Called from inside OrderFlow when the buyer confirms. Forwards the result
      to the parent (which creates the Draft PO + navigates), then closes. */
  const handleOrderFlowComplete = (result: OrderFlowResult) => {
    setOrderFlowOpen(false);
    setOrderFlowItem(null);
    setOrderFlowDemand(undefined);
    /* Only fire when the buyer actually pressed Buy Now / Place Draft.
       Add-to-cart from this entrypoint is intentionally ignored — Demands
       always lands in a Draft. */
    if (result.completedMode !== "buy-now") return;
    if (onConfirmDraftPO) {
      onConfirmDraftPO(result);
    } else {
      /* Fallback when wired into an older parent — at least open the catalogue
         pre-filled so the buyer can continue manually. */
      onCreatePO({ searchTerm: result.item.itemNumber, vendor: result.item.partnerLocation });
    }
  };

  /* Request handlers */
  const updateRequest = (id: string, patch: Partial<PurchaseRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const approveRequest = (r: PurchaseRequest) => {
    updateRequest(r.id, { status: "Approved" });
    toast.success(`Request approved — ${r.requesterName} will be notified`);
  };

  const denyRequest = (r: PurchaseRequest, reason: string) => {
    updateRequest(r.id, { status: "Denied", denyReason: reason });
    toast.success(`Request denied — requester notified`, { description: `Reason: ${reason}` });
  };

  const deferRequest = (r: PurchaseRequest, until: string) => {
    updateRequest(r.id, { status: "Deferred", deferUntil: until });
    toast.success(`Deferred — will resurface on ${until}`);
  };

  /* ─── Filtered demand items ─── */
  const filteredDemandItems = useMemo(() => {
    // Show every demand item by default. Items without a matching
    // planner registry entry still appear — their Severity / First
    // violation / Current ATP cells fall back to "—" but the other
    // columns (Description / Stock / Gap / Sources / Owner / etc.)
    // carry real data, so the row is still useful. Sort below
    // promotes planner-tracked rows so the buyer sees actionable
    // status at the top of the page.
    let items = [...demandItems];

    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          i.preferredVendor.toLowerCase().includes(q) ||
          i.sources.some((s) => s.reference.toLowerCase().includes(q))
      );
    }

    if (filterUrgency !== "all") {
      items = items.filter((i) => urgencyForItem(i) === filterUrgency);
    }

    /* Source narrowing is owned by `params.sources` (applied a few
       lines below in the scope-filter block) — the toolbar's
       Demand Source filter mutates that array directly via
       `handleScopeRefine`. The legacy local single-select branch
       was removed when the toolbar consolidated to multi-select. */

    if (params.purchasingOwners.length > 0) {
      items = items.filter((i) => {
        const own = ownerByItemCode.get(i.itemCode);
        return !!own && params.purchasingOwners.includes(own.owner);
      });
    }

    if (params.acquisitionMethods.length > 0) {
      items = items.filter((i) => {
        const acq = acquisitionByItemCode.get(i.itemCode);
        if (!acq) return false;
        return (
          params.acquisitionMethods.includes(acq.primary) ||
          (acq.secondary != null && params.acquisitionMethods.includes(acq.secondary))
        );
      });
    }

    if (allVendorFilter !== "all") {
      items = items.filter((i) => i.preferredVendor === allVendorFilter);
    }

    /* ── Parameter-set filters (Phase 1) ───────────────────────
       Layered on TOP of the existing toolbar filters so the buyer
       can refine post-apply via the toolbar without losing the
       parameter-set scoping. Empty arrays = no narrowing. */
    if (params.sources.length > 0) {
      items = items.filter((i) =>
        i.sources.some((s) => params.sources.includes(s.kind)),
      );
    }
    if (params.categories.length > 0) {
      items = items.filter((i) => {
        const cat = categoryByItemCode.get(i.itemCode);
        return !!cat && params.categories.includes(cat);
      });
    }
    /* Item-level filter — pin specific items (entry-modal item picker). */
    if (params.items.length > 0) {
      items = items.filter((i) => params.items.includes(i.itemCode));
    }
    /* "Mine" lens — scope to items the buyer owns (entry-modal toggle). */
    if (params.mineOnly) {
      items = items.filter((i) => ownerByItemCode.get(i.itemCode)?.ownedByMe === true);
    }
    /* Severity bands — free-combine + additive healthy inclusion. Two
       overlaid predicates:
         · Band membership: items with a band pass when either no band
           filter is set OR their band is in the selected set.
         · "Include items without issues" (Eli 2026-07-09 → additive
           per 2026-07-16 correction): items with NO live band pass
           when the toggle is on. In the previous exclusive logic, the
           toggle only fired when no bands were selected; now it stacks
           on top of any band selection — buyer can ask for "below-min
           AND above-max AND healthy" all at once.

       Above-max refinement (Nophil 2026-07-14): when the buyer picked
       an `overstockThreshold`, apply it ONLY to rows whose band is
       `above-max`. Other bands (below-zero / below-min / below-max)
       are unaffected by the threshold so mixing filters stays sane. */
    {
      const thr = params.overstockThreshold ?? null;
      const bandsActive = params.bands.length > 0;
      const includeHealthy = !!params.includeItemsWithoutIssues;
      items = items.filter((i) => {
        const band = bandByItemCode.get(i.itemCode);
        if (band == null) {
          /* Healthy row — no live band. Passes when the "include
             without issues" toggle is on. Also passes on the default
             view (no bands selected, toggle off) → false. Never blocked
             by the band selection alone. */
          return includeHealthy;
        }
        if (bandsActive && !params.bands.includes(band)) return false;
        if (band === "above-max" && thr && thr.mode !== "any") {
          const item = PLANNER_ITEMS.find((p) => p.itemCode === i.itemCode);
          const atp = projectionByItemCode.get(i.itemCode)?.currentAtp;
          if (!item || atp == null) return false;
          const delta = atp - item.maxLevel;
          if (thr.mode === "pct") {
            const pct = item.maxLevel > 0 ? (delta / item.maxLevel) * 100 : 0;
            if (pct < thr.value) return false;
          } else if (thr.mode === "qty") {
            if (delta < thr.value) return false;
          }
        }
        return true;
      });
    }
    /* Need-by timing — drives the decision-oriented presets ("Overdue
       now", "Due this week"). `daysToEarliestNeed` returns the days
       from today to the earliest source need-by date (negative = past,
       999 sentinel = no date known). */
    if (params.timing === "overdue") {
      items = items.filter((i) => {
        const d = daysToEarliestNeed(i);
        return d < 0;
      });
    } else if (params.timing === "due") {
      items = items.filter((i) => {
        const d = daysToEarliestNeed(i);
        return d >= 0 && d <= params.horizonDays;
      });
    }

    /* First-time experience: items already in the sandbox plan are HIDDEN from
       the listing for EVERY filter combination — the listing surfaces NEW items
       to plan; an item already in the plan lives in the sandbox, not re-listed
       here. (Flag-gated; see HIDE_IN_PLAN_ITEMS.) Recurring (dev) mode lists
       them instead, with the per-row "In plan" pill. */
    if (HIDE_IN_PLAN_ITEMS && userMode !== "recurring" && openSandboxItems.length > 0) {
      const inPlan = new Set(openSandboxItems);
      items = items.filter((i) => !inPlan.has(i.itemCode));
    }

    /* Sort. The DEFAULT view groups by category (A→Z) and within each
       category orders most-severe-first (Below Zero > Below Min >
       Below Max > healthy) — the manager scans one product family at a
       time, worst rows on top. The system never claims a row is "more
       important" than another beyond this objective severity order.
       Clicking a column header switches to that column's sort with an
       asc/desc toggle (per-column sorting). */
    const atpOf = (i: DemandItem) =>
      projectionByItemCode.get(i.itemCode)?.currentAtp ?? Number.POSITIVE_INFINITY;
    const issueTimeOf = (i: DemandItem) => {
      const fv = projectionByItemCode.get(i.itemCode)?.firstViolation;
      return fv ? new Date(fv).getTime() : Number.POSITIVE_INFINITY;
    };
    /* Need-by sort mirrors the cell: earliest document date, dateless
       rows last. */
    const needTimeOf = (i: DemandItem) => {
      const d = earliestNeedDate(i);
      return d ? new Date(d).getTime() : Number.POSITIVE_INFINITY;
    };
    items.sort((a, b) => {
      if (sortBy === "default") {
        const ca = (categoryByItemCode.get(a.itemCode) ?? "").localeCompare(
          categoryByItemCode.get(b.itemCode) ?? "",
        );
        if (ca !== 0) return ca;
        const sv =
          severityRank(bandByItemCode.get(b.itemCode)) -
          severityRank(bandByItemCode.get(a.itemCode));
        if (sv !== 0) return sv;
        return a.itemCode.localeCompare(b.itemCode);
      }
      let cmp = 0;
      switch (sortBy) {
        case "item":
          cmp = a.itemCode.localeCompare(b.itemCode);
          break;
        case "description":
          cmp = a.itemName.localeCompare(b.itemName);
          break;
        case "gap":
          cmp = gapFor(a) - gapFor(b);
          break;
        case "atp":
          cmp = atpOf(a) - atpOf(b);
          break;
        case "sources":
          /* Documents only — Low Stock isn't a source. */
          cmp = demandDocsFor(a).length - demandDocsFor(b).length;
          break;
        case "issues":
          cmp = issueTimeOf(a) - issueTimeOf(b);
          break;
        case "needBy":
          cmp = needTimeOf(a) - needTimeOf(b);
          break;
        case "owner":
          cmp = (ownerByItemCode.get(a.itemCode)?.owner ?? "").localeCompare(
            ownerByItemCode.get(b.itemCode)?.owner ?? "",
          );
          break;
        case "acquisition":
          cmp = (acquisitionByItemCode.get(a.itemCode)?.primary ?? "").localeCompare(
            acquisitionByItemCode.get(b.itemCode)?.primary ?? "",
          );
          break;
      }
      if (cmp === 0) cmp = a.itemCode.localeCompare(b.itemCode);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [demandItems, globalSearch, filterUrgency, ownerByItemCode, acquisitionByItemCode, allVendorFilter, sortBy, sortDir, params, categoryByItemCode, projectionByItemCode, bandByItemCode, openSandboxItems, userMode]);

  /* Unique vendor list — used by the All-Demand & Low-Stock vendor filter. */
  const uniqueVendors = useMemo(
    () => Array.from(new Set(demandItems.map((i) => i.preferredVendor))).sort(),
    [demandItems],
  );

  /* Inputs for the Recommend POs modal — every in-scope row that
     has a recommendation entry. We join `filteredDemandItems` against
     `recommendationByItemCode` so the modal only ever sees items the
     current parameter scope (sources / categories / levels) has
     surfaced. Items with no recommendation but with conflicts still
     pass through — the modal renders those conflicts as banners so
     the buyer learns why nothing was teed up for that item. */
  const recommendModalInputs = useMemo<ItemRecommendationInput[]>(() => {
    const out: ItemRecommendationInput[] = [];
    const seen = new Set<string>();
    for (const di of filteredDemandItems) {
      if (seen.has(di.itemCode)) continue;
      seen.add(di.itemCode);
      const rec = recommendationByItemCode.get(di.itemCode);
      if (!rec) continue;
      if (rec.recommendations.length === 0 && rec.conflicts.length === 0) continue;
      out.push({
        item: rec.item,
        recommendations: rec.recommendations,
        conflicts: rec.conflicts,
      });
    }
    return out;
  }, [filteredDemandItems, recommendationByItemCode]);

  /* Count of vendor-level draft POs the engine would tee up across
     the in-scope items — drives the action button badge so the buyer
     sees the size of the batch before opening the modal. */
  const recommendActionCount = useMemo(() => {
    let n = 0;
    for (const input of recommendModalInputs) {
      n += input.recommendations.length;
    }
    return n;
  }, [recommendModalInputs]);

  /* Priority pinning + rank maps removed — the system no longer ranks
     items for the manager. Rows order by category + objective severity
     (or the column the manager sorts by). */

  const demandPageCount = Math.max(1, Math.ceil(filteredDemandItems.length / PAGE_SIZE));
  const demandPageItems = filteredDemandItems.slice((demandPage - 1) * PAGE_SIZE, demandPage * PAGE_SIZE);

  /* ─── Filtered requests ─── */
  const filteredRequests = useMemo(() => {
    let rs = [...requests];
    // Quick-pill filter (single-select) — applies AND independently from
    // the modal's multi-select status filter below.
    if (quickRequestStatus !== "all") {
      rs = rs.filter((r) => r.status === quickRequestStatus);
    }
    if (requestStatusFilter.length > 0) {
      rs = rs.filter((r) => requestStatusFilter.includes(r.status));
    }
    if (requestSearch) {
      const q = requestSearch.toLowerCase();
      rs = rs.filter(
        (r) =>
          r.requesterName.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.itemCode.toLowerCase().includes(q)
      );
    }
    return rs;
  }, [requests, quickRequestStatus, requestStatusFilter, requestSearch]);

  const requestsPageCount = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const requestsPageItems = filteredRequests.slice((requestsPage - 1) * PAGE_SIZE, requestsPage * PAGE_SIZE);

  /* ─── Low Stock items (filtered by toolbar) ─── */
  const lowStockItems = useMemo(() => {
    let items = demandItems.filter((i) => i.reorderPoint !== undefined);
    if (lowStockSearch) {
      const q = lowStockSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          i.preferredVendor.toLowerCase().includes(q),
      );
    }
    if (lowStockVendorFilter !== "all") {
      items = items.filter((i) => i.preferredVendor === lowStockVendorFilter);
    }
    return items;
  }, [demandItems, lowStockSearch, lowStockVendorFilter]);
  const lowStockPageCount = Math.max(1, Math.ceil(lowStockItems.length / PAGE_SIZE));
  const lowStockPageItems = lowStockItems.slice((lowStockPage - 1) * PAGE_SIZE, lowStockPage * PAGE_SIZE);

  /* ─── Filtered Sales Orders (by toolbar) ─── */
  const filteredSalesOrders = useMemo(() => {
    let sos = [...MOCK_SOS];
    if (salesSearch) {
      const q = salesSearch.toLowerCase();
      sos = sos.filter(
        (so) =>
          so.soNumber.toLowerCase().includes(q) ||
          so.customer.toLowerCase().includes(q) ||
          so.lineItems.some((li) =>
            li.itemCode.toLowerCase().includes(q) || li.itemName.toLowerCase().includes(q),
          ),
      );
    }
    if (salesDueFilter !== "all") {
      sos = sos.filter((so) => {
        const days = Math.ceil((new Date(so.dueDate).getTime() - TODAY.getTime()) / 86400000);
        if (salesDueFilter === "overdue") return days < 0;
        if (salesDueFilter === "soon") return days >= 0 && days <= 7;
        if (salesDueFilter === "later") return days > 7;
        return true;
      });
    }
    if (salesGapFilter !== "all") {
      sos = sos.filter((so) => {
        const gaps = so.lineItems.filter((li) => li.have < li.need).length;
        if (salesGapFilter === "with-gaps") return gaps > 0;
        if (salesGapFilter === "fulfilled") return gaps === 0;
        return true;
      });
    }
    return sos;
  }, [salesSearch, salesDueFilter, salesGapFilter]);

  /* ─── Filtered Stale POs (by toolbar) ─── */
  const filteredStalePOs = useMemo(() => {
    let pos = [...stalePOs];
    if (staleSearch) {
      const q = staleSearch.toLowerCase();
      pos = pos.filter(
        (p) =>
          p.poNumber.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q),
      );
    }
    if (staleStatusFilter !== "all") {
      pos = pos.filter((p) => p.status === staleStatusFilter);
    }
    return pos;
  }, [stalePOs, staleSearch, staleStatusFilter]);

  /* ─── Summary card data ─── */
  const itemsWithSOGap = demandItems.filter((i) => i.sources.some((s) => s.kind === "SO")).length;
  const itemsWithLowStock = demandItems.filter((i) => i.sources.some((s) => s.kind === "LowStock")).length;
  const itemsWithRequest = demandItems.filter((i) => i.sources.some((s) => s.kind === "Request")).length;
  const itemsWithAboveMax = 0; // for parity with original spec

  const reqStats = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "Pending").length,
      approved: requests.filter((r) => r.status === "Approved").length,
      denied: requests.filter((r) => r.status === "Denied").length,
      deferred: requests.filter((r) => r.status === "Deferred").length,
    }),
    [requests],
  );

  const stale7 = stalePOs.filter((p) => p.status === "Draft" && p.daysStale >= 7).length;
  const stale14 = stalePOs.filter((p) => p.status === "Sent" && p.daysStale >= 14).length;

  /** Unique vendor list for Low Stock toolbar filter. */
  const lowStockVendors = useMemo(
    () => Array.from(new Set(demandItems.filter((i) => i.reorderPoint !== undefined).map((i) => i.preferredVendor))).sort(),
    [demandItems],
  );

  /* ─── Bulk Create POs — preview step ───
     Groups the selected demand items by preferred vendor and opens the
     Multi-PO confirmation modal as a PREVIEW. No POs are created yet;
     the modal's primary button is the actual confirmation step.

     Spec rule (Step 1): items with a non-healthy ATP projection must
     flow through the Sandbox so the validates-green / MOQ / lead-time
     gates fire. We filter those out of the bulk selection up front and
     surface a toast pointing the buyer at the Sandbox path. Healthy
     items continue through the normal bulk preview. */
  /* Take every selected item into the Procurement Planning sandbox in one
     action: add each item code to the planner session (deduped + persisted),
     then navigate to the first — the workspace opens them all as tabs since
     it only appends the route item to the existing session, never resets it. */
  const bulkPlanInSandbox = () => {
    const codes = demandItems
      .filter((i) => selectedItems.has(i.id))
      .map((i) => i.itemCode);
    if (codes.length === 0) return;
    codes.forEach(openPlannerItem);
    setSelectedItems(new Set());
    onPlanInSandbox?.(codes[0]);
  };

  const bulkCreatePOs = () => {
    const rawSelected = demandItems.filter((i) => selectedItems.has(i.id));
    if (rawSelected.length === 0) return;

    const distressed = rawSelected.filter((i) => {
      const p = projectionByItemCode.get(i.itemCode);
      return !!p && p.worstSeverity !== "healthy";
    });
    const selected = rawSelected.filter((i) => !distressed.includes(i));

    if (distressed.length > 0) {
      toast.warning(
        `${distressed.length} distressed item${distressed.length === 1 ? "" : "s"} excluded`,
        {
          description: distressed.length === 1
            ? `${distressed[0].itemCode} must be planned in the Sandbox — click its "Plan" button.`
            : `Items projected to stock out must go through the Sandbox individually so MOQ / lead-time / validates-green gates fire.`,
        },
      );
    }

    if (selected.length === 0) return;

    /* Group by preferred vendor. */
    const vendorMap = new Map<string, DemandItem[]>();
    selected.forEach((item) => {
      const list = vendorMap.get(item.preferredVendor) || [];
      list.push(item);
      vendorMap.set(item.preferredVendor, list);
    });

    const previews: POPreview[] = [];
    vendorMap.forEach((items, vendor) => {
      const lineItems = items.map((it) => {
        const need = totalDemandFor(it);
        const qty = Math.max(1, need || 1);
        return {
          id: it.id,
          itemNumber: it.itemCode,
          descriptiveName: it.itemName,
          image: it.itemImage,
          unitPrice: it.unitPrice,
          vendorQty: qty,
          vendorUOM: it.uom,
          vendorUOMQty: 1,
          quantity: qty,
          defaultUOM: it.uom,
          discount: 0,
          shipmentMethod: "ground",
          dueDeliveryDate: it.neededBy || "",
          inboundLocation: "",
          category: "",
        };
      });
      const total = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
      previews.push({
        key: `preview-${vendor}`,
        vendor,
        total,
        itemCount: items.length,
        lineItems,
      });
    });

    setMultiPOChecked(new Set(previews.map((p) => p.key)));
    setMultiPOModal({ previews });
  };

  /* Confirm step — actually creates POs for everything currently
     checked in the modal, then navigates. */
  const confirmBulkCreatePOs = () => {
    if (!multiPOModal) return;
    const toCreate = multiPOModal.previews.filter((p) => multiPOChecked.has(p.key));
    if (toCreate.length === 0) return;

    const created = toCreate.map((p) => {
      const po = createPOFromVendorCheckout(p.vendor, p.lineItems);
      return { id: po.id, poNumber: po.poNumber, vendor: p.vendor };
    });

    setSelectedItems(new Set());
    setMultiPOModal(null);
    setMultiPOChecked(new Set());

    if (created.length === 1) {
      toast.success(`PO ${created[0].poNumber} created`);
      navigate(`/purchase-orders/${created[0].id}`);
    } else {
      toast.success(`${created.length} POs created — one per default vendor`);
      created.slice(1).forEach((po) => {
        window.open(`/purchase-orders/${po.id}`, "_blank");
      });
      navigate(`/purchase-orders/${created[0].id}`);
    }
  };

  /* ─── Render ─── */
  return (
    /* Root fills the viewport — the data table needs every pixel of
       width it can get for its many columns. The narrower 1120px cap
       (the Dashboard-tab constraint) is applied only to the entry-
       form section below, where a centered, contained surface reads
       like a settings page. */
    <div className="flex flex-1 min-h-0 flex-col gap-4" style={{ fontFamily: FONT }}>
      {/* Page-level filter / search / column controls live inside each
         table's own DemandTableToolbar — no global row needed. */}

      {/* ═════════ INNER TAB STRIP ═════════
         The pill-tab strip lives inside each table card now (see
         renderDemandsTabsRow() below). This block intentionally renders
         nothing at the page level — keeping the helper here so each tab's
         card can mount its own copy as the first row. */}

      {/* ═════════ ALL DEMAND TAB ═════════
         The tab lands directly on the listing — no intermediate
         entry / scope-builder surface. The inline filter bar at the
         top of the table card is the always-visible scope control;
         the toolbar (search · filters · density · columns · owners)
         handles in-place refinement. */}
      {activeDemandsTab === "all" && (
        <section className="flex flex-1 min-h-0 flex-col gap-3" data-demand-gaps>
          {/* The educational violet banner + "Edit filters" round-
             trip were retired — the inline filter bar at the top of
             the table card below is now the single, always-visible
             scope control. Saves a row of vertical space and the
             buyer never leaves the listing to adjust scope. */}
          {/* The page-level "System has N recommended draft POs ready
             …" strip + violet "Recommend POs" button were retired —
             the strip ate a full row of vertical space above the
             table for an action the buyer can still reach through
             other planning surfaces. The RecommendedPOsModal stays
             mounted below; re-attach a trigger if/when one is
             needed. */}
          <div className="border border-border rounded-lg bg-card flex flex-1 min-h-0 overflow-clip">
            <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-clip">
            {/* ── Inline filter bar (primary control) ──
               Sits at the very top of the card and is now the
               only chrome above the toolbar — the sub-tabs row
               (All Demand · Stale POs) was hidden per request to
               re-enable later. Re-enable by uncommenting the
               `{renderDemandsTabsRow()}` line below; the
               function, the `activeDemandsTab` state, the Stale
               POs branch + table component all stay intact so
               flipping the switch back is a one-line change. */}
            <PlannerScopeQuestionnaire
              open={scopeModalOpen}
              initial={params}
              categoriesList={uniqueCategories}
              categoryCodes={categoryCodeByName}
              myOwnerName={myOwnerName}
              sourceCounts={scopeSourceCounts}
              categoryCounts={scopeCategoryCounts}
              bandCounts={scopeBandCounts}
              ownerOptions={scopeOwnerOptions}
              acquisitionCounts={scopeAcquisitionCounts}
              onApply={(next) => {
                handleScopeRefine(next);
                scopeAppliedThisLoad = true;
                setScopeApplied(true);
                setScopeModalOpen(false);
              }}
            />
            {/* The scope controls now live in the hero header
               (PlannerScopeBar variant="hero") mounted just below, above the
               DemandTableToolbar. This Dialog is the "More filters" surface. */}
            <PlannerManageCategoriesModal
              open={catConfigureOpen}
              onOpenChange={setCatConfigureOpen}
              selectedCodes={params.categories}
              onChange={(codes) => handleScopeRefine({ ...params, categories: codes })}
              mineOnly={params.mineOnly}
              codeByName={categoryCodeByName}
            />
            {/* Sub-tab strip removed per feedback ("I don't want the header
               row that is All Demand, Stale POs and Add button"). Only the
               'all' branch renders anyway; other sub-tab branches (stale /
               sales-orders / low-stock / requests) stay behind feature
               flags and are unreachable without the strip. Manage-items
               modal below is kept — reachable via the toolbar's Filters
               modal if we later re-expose an "add items" affordance. */}
            {/* Manage items modal — was previously opened by the '+' pin
               on the (removed) sub-tab strip. Kept mounted so its state
               and integration with params.items survives; re-attach a
               trigger if/when we bring back an "add items" affordance. */}
            <PlannerManageItemsModal
              open={manageItemsOpen}
              onOpenChange={setManageItemsOpen}
              items={plannerItemUniverse}
              selectedCodes={params.items}
              onChange={(codes) => handleScopeRefine({ ...params, items: codes })}
            />
            {/* Toolbar (search · filters · density · columns · reset) mounts
               FIRST, immediately after the (removed) sub-tab strip. Mirrors
               the Partners listing pattern where search + filters trigger sit
               above the filter pill row — see PODataTable.tsx:927-1094. */}
            {scopeApplied && <DemandTableToolbar
              searchPlaceholder="Search items, vendors, SO numbers..."
              search={globalSearch}
              onSearchChange={(v) => {
                setGlobalSearch(v);
                setDemandPage(1);
              }}
              countLabel={
                filteredDemandItems.length === demandItems.length
                  ? `${demandItems.length} items`
                  : `${filteredDemandItems.length} of ${demandItems.length} items`
              }
              onOpenFilters={() => setScopeModalOpen(true)}
              filterCount={activeScopeFilterCount}
              filterGroups={[
                /* The three scope filters (Time horizon · Demand
                   sources · Categories) + the severity band chips
                   moved into the InlineFilterBar above so they're
                   always visible without a modal round-trip. Only
                   the listing-only refinements (Owner · Preferred
                   Vendor · Sort By) live in the Filters modal now. */
                {
                  key: "owner",
                  title: "Purchasing Owner",
                  subtitle:
                    params.purchasingOwners.length === 0
                      ? "All owners included by default. Pick to narrow."
                      : "Filter to one or more purchasing owners.",
                  multi: true,
                  value: params.purchasingOwners,
                  onChange: (v) =>
                    handleScopeRefine({ ...params, purchasingOwners: Array.isArray(v) ? v : [] }),
                  options: uniqueOwners.map((name) => ({
                    value: name,
                    label: myOwnerName && name === myOwnerName ? `${name} (You)` : name,
                    count: demandItems.filter((i) => ownerByItemCode.get(i.itemCode)?.owner === name).length,
                  })),
                },
                {
                  key: "acquisition",
                  title: "Acquisition Method",
                  subtitle:
                    params.acquisitionMethods.length === 0
                      ? "All methods included by default. Pick to narrow."
                      : "Filter by how items are sourced.",
                  multi: true,
                  value: params.acquisitionMethods,
                  onChange: (v) =>
                    handleScopeRefine({ ...params, acquisitionMethods: Array.isArray(v) ? v : [] }),
                  options: (["Purchased", "Manufactured"] as const).map((m) => ({
                    value: m,
                    label: m,
                    count: demandItems.filter((i) => {
                      const acq = acquisitionByItemCode.get(i.itemCode);
                      return !!acq && (acq.primary === m || acq.secondary === m);
                    }).length,
                  })),
                },
                {
                  key: "vendor",
                  title: "Preferred Vendor",
                  subtitle: "Filter by preferred vendor",
                  searchAfter: 6,
                  value: allVendorFilter,
                  onChange: (v) => {
                    setAllVendorFilter(v as string);
                    setDemandPage(1);
                  },
                  options: [
                    { value: "all", label: "All vendors" },
                    ...uniqueVendors.map((v) => ({ value: v, label: v.split(" (")[0] })),
                  ],
                },
                /* The "Sort By" dropdown was retired — every column
                   header is now click-to-sort (asc/desc), so a second
                   ordering control in the toolbar was redundant. */
              ]}
              density={allDensity}
              onDensityChange={setAllDensity}
              cardView={allCardView}
              onCardViewChange={setAllCardView}
              cardSize={allCardSize}
              onCardSizeChange={setAllCardSize}
              columns={ALL_DEMAND_COLUMNS}
              hiddenColumns={allHiddenCols}
              onColumnToggle={(id) => toggleInSet(setAllHiddenCols, id)}
              onOpenColumns={() => setColumnDrawerOpen(true)}
              columnsDrawerOpen={columnDrawerOpen}
              onReset={() => {
                setGlobalSearch("");
                setFilterUrgency("all");
                setAllVendorFilter("all");
                setSortBy("default");
                setSortDir("asc");
                setAllHiddenCols(new Set());
                setAllColumnOrder(ALL_DEMAND_COLUMNS.map((c) => c.id));
                setAllDensity("condensed");
                setAllCardView(false);
                setAllCardSize("medium");
                /* Also reset the scope back to defaults — a full
                   "clear all filters" sweep returns the listing to its
                   empty state (no scope set). Persists too. */
                handleScopeRefine(DEFAULT_PARAMS);
              }}
            />}
            {/* ── SCOPE-BAR / BULK-SELECTION ROW ──
               These two rows are MUTUALLY EXCLUSIVE — they occupy the same
               vertical slot below the toolbar and swap when the buyer starts
               selecting table rows. No selection → filter chip row (Partners
               look, PODataTable.tsx:1096–1200). Selection > 0 → bulk-action
               bar takes the same slot instead. Deselecting all restores the
               filter row. Feedback: "the bulk controls should swap with the
               filter row, not add a new row underneath it." */}
            {scopeApplied &&
              (!SHOW_BULK_MULTISELECT || selectedItems.size === 0) && <PlannerScopeBar
              variant="hero"
              applied
              onOpenFilters={() => setScopeModalOpen(true)}
              params={params}
              onChange={handleScopeRefine}
              onConfigureCategories={() => setCatConfigureOpen(true)}
              categoriesList={uniqueCategories}
              categoryCodes={categoryCodeByName}
              sourceCounts={scopeSourceCounts}
              categoryCounts={scopeCategoryCounts}
              bandCounts={scopeBandCounts}
              ownerOptions={scopeOwnerOptions}
              acquisitionCounts={scopeAcquisitionCounts}
              /* Sandbox resume/count props intentionally omitted — the
                 "Open sandbox" CTA now lives in the top page header (see
                 PurchaseOrdersListing.tsx), so surfacing it here would
                 duplicate the control on the same tab. */
            />}
            {/* Bulk-selection bar — same slot as the scope-bar row above;
               only one renders at a time. Feedback ("swap the rows"): the
               bulk controls take over the filter row's position instead of
               stacking underneath it. */}
            {SHOW_BULK_MULTISELECT && selectedItems.size > 0 && (() => {
              const n = selectedItems.size;
              return (
                /* Bulk-selection bar — Partners listing pattern:
                     · Blue "N items selected" text on the left (text-primary,
                       weight 500, 13px — same tokens Partners uses).
                     · Vertical divider to segment count from actions.
                     · "Sandbox this item (N)" primary-tinted outline action
                       (border-primary/30 · bg-primary/5 · text-primary) —
                       exact treatment as the Partners bulk-bar actions.
                     · "✕ Clear selection" pinned to the right (ml-auto,
                       ghost slate treatment). */
                /* Match the scope-bar's px-4 py-3 padding exactly so the
                   swap (filter row ⇄ bulk bar) doesn't jump the row height.
                   `-mt-px` removed so the toolbar's bottom border shows
                   through as this row's top line — matching the filter
                   row's own top border. */
                <div
                  className="flex items-center gap-2 px-4 py-3 shrink-0 relative border-b border-border bg-white"
                  style={{ fontFamily: FONT }}
                >
                  <span className="text-[12px] text-primary shrink-0" style={{ fontWeight: 500, fontFamily: FONT }}>
                    {n} {n === 1 ? "item" : "items"} selected
                  </span>
                  <div className="h-4 w-px bg-border shrink-0 mx-0.5" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 gap-1.5 text-[12px] border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                    style={{ fontFamily: FONT, fontWeight: 500 }}
                    onClick={bulkPlanInSandbox}
                  >
                    <FlaskConical className="size-3" />
                    {n === 1 ? "Sandbox this item" : "Sandbox these items"} ({n})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 gap-1.5 text-[12px] text-slate-500 hover:text-slate-700"
                    style={{ fontFamily: FONT, fontWeight: 500 }}
                    onClick={() => setSelectedItems(new Set())}
                  >
                    <X className="size-3" />
                    Clear selection
                  </Button>
                </div>
              );
            })()}
            {/* FTU landing surface — the inline scope questionnaire IS the
               first-time-user experience (dev-mode "first-time"). On apply,
               `scopeApplied` flips and the compact chip bar + toolbar + table
               take over. Dev-mode "recurring" bypasses this and lands
               straight on the table with saved params. Post-apply, the "no
               items match" empty state still fires when the scope narrows
               to zero rows. */}
            {!scopeApplied ? (
              <PlannerScopeQuestionnaire
                variant="inline"
                open
                initial={params}
                categoriesList={uniqueCategories}
                categoryCodes={categoryCodeByName}
                myOwnerName={myOwnerName}
                sourceCounts={scopeSourceCounts}
                categoryCounts={scopeCategoryCounts}
                bandCounts={scopeBandCounts}
                ownerOptions={scopeOwnerOptions}
                acquisitionCounts={scopeAcquisitionCounts}
                totalItemsCount={demandItems.length}
                computeMatchingCount={computeScopeMatchCount}
                onApply={(next) => {
                  handleScopeRefine(next);
                  scopeAppliedThisLoad = true;
                  setScopeApplied(true);
                }}
              />
            ) : filteredDemandItems.length === 0 ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="No items match your filters"
                description="No demand items fall within the current scope. Try widening or clearing the filters above — Time horizon · Demand sources · Categories, and the Below Zero / Below Minimum / Below Maximum issues."
              />
            ) : (
              <>
                {!hasActiveScope && !defaultHintDismissed && (
                  <div
                    className="mb-3 flex items-center gap-2.5 rounded-lg border px-3 py-2"
                    style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--primary-tint))" }}
                  >
                    <Info className="size-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                    <span className="flex-1 text-[12.5px]" style={{ color: "hsl(var(--foreground))", fontFamily: FONT }}>
                      Showing the default view: all sources, next 30 days. Use the filters above to focus on specific sources, categories, or issues.
                    </span>
                    <button
                      type="button"
                      onClick={() => setDefaultHintDismissed(true)}
                      className="shrink-0 rounded p-1 transition-colors hover:bg-black/5"
                      aria-label="Dismiss"
                    >
                      <X className="size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                    </button>
                  </div>
                )}
                <ByItemView
                  items={demandPageItems}
                  selectedItems={selectedItems}
                  showSelect={SHOW_BULK_MULTISELECT}
                  density={allDensity}
                  cardView={allCardView}
                  cardSize={allCardSize}
                  hiddenColumns={allHiddenCols}
                  columnOrder={allColumnOrder}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={(k) => handleColumnSort(k as AllDemandSortKey)}
                  onSetSort={(k, dir) => {
                    setSortBy(k as AllDemandSortKey);
                    setSortDir(dir);
                  }}
                  onHideColumn={(colId) =>
                    setAllHiddenCols((prev) => {
                      const next = new Set(prev);
                      next.add(colId);
                      return next;
                    })
                  }
                  onToggleSelect={toggleSelect}
                  onToggleSelectMany={toggleSelectMany}
                  onCreatePO={onCreatePO}
                  onCreateDemandPO={openCreatePOForDemand}
                  onCreateDemandPOForSource={openCreatePOForSource}
                  projectionByItemCode={projectionByItemCode}
                  bandByItemCode={bandByItemCode}
                  ownerByItemCode={ownerByItemCode}
                  acquisitionByItemCode={acquisitionByItemCode}
                  onPlanInSandbox={onPlanInSandbox}
                  onOpenItemQuickView={openItemQuickView}
                  onOpenTransactions={(code) => {
                    const pi = PLANNER_ITEMS.find((p) => p.itemCode === code);
                    if (pi) setTxnItem(pi);
                  }}
                  searchQuery={globalSearch}
                  onColumnOrderChange={setAllColumnOrder}
                />
                <PaginationFooter
                  page={demandPage}
                  pageCount={demandPageCount}
                  onChange={setDemandPage}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
            </div>
            <ColumnSelector
              columns={ALL_DEMAND_COLUMNS.map((c) => ({ key: c.id, label: c.label }))}
              columnOrder={allColumnOrder}
              columnVisibility={Object.fromEntries(
                ALL_DEMAND_COLUMNS.map((c) => [c.id, !allHiddenCols.has(c.id)]),
              )}
              onColumnOrderChange={setAllColumnOrder}
              onColumnVisibilityChange={(vis) => {
                const next = new Set<string>();
                ALL_DEMAND_COLUMNS.forEach((c) => {
                  if (vis[c.id] === false && !c.alwaysVisible) next.add(c.id);
                });
                setAllHiddenCols(next);
              }}
              lockedColumns={ALL_DEMAND_COLUMNS.filter((c) => c.alwaysVisible).map(
                (c) => c.id,
              )}
              open={columnDrawerOpen}
              onOpenChange={setColumnDrawerOpen}
            />
          </div>
        </section>
      )}

      {/* ═════════ SALES ORDERS TAB ═════════ */}
      {activeDemandsTab === "sales-orders" && (
        <section className="flex flex-col gap-3" data-sales-orders>
          <DemandInfoBanner icon={Building2}>
            Open sales orders and the line items promised to customers. Cover any unfulfilled
            quantities by creating a PO straight from the row.
          </DemandInfoBanner>
          <div className="border border-border rounded-lg bg-card flex flex-col min-h-0 overflow-clip">
            {/* renderDemandsTabsRow() removed — sub-tab strip retired */}
            <DemandTableToolbar
              searchPlaceholder="Search SOs, customers, items..."
              search={salesSearch}
              onSearchChange={setSalesSearch}
              countLabel={
                filteredSalesOrders.length === MOCK_SOS.length
                  ? `${MOCK_SOS.length} sales orders`
                  : `${filteredSalesOrders.length} of ${MOCK_SOS.length} sales orders`
              }
              filterGroups={[
                {
                  key: "due",
                  title: "Due Window",
                  subtitle: "Filter by SO delivery deadline",
                  value: salesDueFilter,
                  onChange: (v) => setSalesDueFilter(v as string),
                  options: [
                    { value: "all", label: "All" },
                    { value: "overdue", label: "Overdue", dotColor: "hsl(var(--danger))" },
                    { value: "soon", label: "Due ≤ 7d", dotColor: "hsl(var(--warning))" },
                    { value: "later", label: "Later", dotColor: "hsl(var(--success))" },
                  ],
                },
                {
                  key: "gap",
                  title: "Fulfilment",
                  subtitle: "Show only SOs with stock gaps",
                  value: salesGapFilter,
                  onChange: (v) => setSalesGapFilter(v as string),
                  options: [
                    { value: "all", label: "All" },
                    { value: "with-gaps", label: "With gaps", dotColor: "hsl(var(--danger))" },
                    { value: "fulfilled", label: "Fulfilled", dotColor: "hsl(var(--success))" },
                  ],
                },
              ]}
              density={salesDensity}
              onDensityChange={setSalesDensity}
              columns={SALES_ORDERS_COLUMNS}
              hiddenColumns={salesHiddenCols}
              onColumnToggle={(id) => toggleInSet(setSalesHiddenCols, id)}
              onReset={() => {
                setSalesSearch("");
                setSalesDueFilter("all");
                setSalesGapFilter("all");
                setSalesHiddenCols(new Set());
                setSalesDensity("condensed");
              }}
            />
            <BySourceView
              sos={filteredSalesOrders}
              expandedSOs={expandedSOs}
              onToggleSO={toggleSO}
              requests={filteredRequests}
              lowStockItems={lowStockPageItems}
              hiddenColumns={salesHiddenCols}
              density={salesDensity}
              allDemandItems={demandItems}
              onCreatePO={onCreatePO}
              onCreateDemandPOForSOLineItem={openCreatePOForSOLineItem}
            />
          </div>
        </section>
      )}

      {/* ═════════ PURCHASE REQUESTS TAB ═════════
           Parked from procurement (2026-07-20 flag). The tab key can
           only be selected when the flag is on, so this section stays
           mounted for the eventual flip-back but never renders while
           the flag is off. */}
      {SHOW_PURCHASE_REQUESTS_IN_PLANNER && activeDemandsTab === "requests" && (
        <section className="flex flex-col gap-3" data-requests>
          <DemandInfoBanner icon={Inbox}>
            Internal asks from teammates waiting on approval. Review the details and turn
            approved ones into a PO without leaving this view.
          </DemandInfoBanner>
          <div className="border border-border rounded-lg bg-card flex flex-col min-h-0 overflow-clip">
            {/* renderDemandsTabsRow() removed — sub-tab strip retired */}
            <DemandTableToolbar
              searchPlaceholder="Search requesters or items..."
              search={requestSearch}
              onSearchChange={(v) => {
                setRequestSearch(v);
                setRequestsPage(1);
              }}
              countLabel={
                filteredRequests.length === requests.length
                  ? `${requests.length} requests`
                  : `${filteredRequests.length} of ${requests.length} requests`
              }
              filterGroups={[
                {
                  key: "status",
                  title: "Request Status",
                  subtitle: "Filter purchase requests by approval state (multi-select)",
                  multi: true,
                  value: requestStatusFilter,
                  onChange: (v) => {
                    setRequestStatusFilter(Array.isArray(v) ? (v as RequestStatus[]) : []);
                    setRequestsPage(1);
                  },
                  options: [
                    { value: "Pending", label: "Pending", count: requests.filter((r) => r.status === "Pending").length, dotColor: "hsl(var(--warning))" },
                    { value: "Approved", label: "Approved", count: requests.filter((r) => r.status === "Approved").length, dotColor: "hsl(var(--success))" },
                    { value: "Denied", label: "Denied", count: requests.filter((r) => r.status === "Denied").length, dotColor: "hsl(var(--danger))" },
                    { value: "Deferred", label: "Deferred", count: requests.filter((r) => r.status === "Deferred").length, dotColor: "hsl(var(--muted-foreground))" },
                  ],
                },
              ]}
              density={requestsDensity}
              onDensityChange={setRequestsDensity}
              columns={REQUEST_COLUMNS}
              hiddenColumns={requestsHiddenCols}
              onColumnToggle={(id) => toggleInSet(setRequestsHiddenCols, id)}
              onReset={() => {
                setRequestSearch("");
                setQuickRequestStatus("all");
                setRequestStatusFilter([]);
                setRequestsHiddenCols(new Set());
                setRequestsDensity("condensed");
                setRequestsPage(1);
              }}
            />
            {/* Quick-filter pills — keeps status one-tap access. */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 shrink-0 border-b border-border bg-card"
              style={{ scrollbarWidth: "none" }}
            >
              {(["all", "Pending", "Approved", "Denied", "Deferred"] as const).map((s) => {
                // Single-select pill — clicking a value replaces the
                // previous selection. Independent from the modal's
                // multi-select status filter.
                const isActive = quickRequestStatus === s;
                const count = s === "all" ? requests.length : requests.filter((r) => r.status === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuickRequestStatus(s);
                      setRequestsPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                    }`}
                    style={{
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? "#0A77FF" : undefined,
                      fontFamily: FONT,
                    }}
                  >
                    {s === "all" ? "All" : s}
                    <span
                      className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                      style={{
                        fontWeight: 600,
                        backgroundColor: isActive
                          ? "color-mix(in srgb, #0A77FF 12%, transparent)"
                          : "hsl(var(--muted))",
                        color: isActive ? "#0A77FF" : "#475569",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <PurchaseRequestsTable
              requests={requestsPageItems}
              density={requestsDensity}
              hiddenColumns={requestsHiddenCols}
              onCreatePO={onCreatePO}
              onCreateDemandPOForRequest={openCreatePOForRequest}
              onDenyRequest={denyRequest}
              onDeferRequest={deferRequest}
            />
            <PaginationFooter
              page={requestsPage}
              pageCount={requestsPageCount}
              onChange={setRequestsPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        </section>
      )}

      {/* ═════════ LOW STOCK TAB ═════════ */}
      {activeDemandsTab === "low-stock" && (
        <section className="flex flex-col gap-3" data-low-stock>
          <DemandInfoBanner icon={AlertTriangle}>
            Items at or below their minimum order quantity. Reorder before they run out, no
            sales order required.
          </DemandInfoBanner>
          <div className="border border-border rounded-lg bg-card flex flex-col min-h-0 overflow-clip">
            {/* renderDemandsTabsRow() removed — sub-tab strip retired */}
            <DemandTableToolbar
              searchPlaceholder="Search items or vendors..."
              search={lowStockSearch}
              onSearchChange={(v) => {
                setLowStockSearch(v);
                setLowStockPage(1);
              }}
              countLabel={`${lowStockItems.length} low-stock items`}
              filterGroups={[
                {
                  key: "vendor",
                  title: "Preferred Vendor",
                  subtitle: "Filter low-stock items by preferred vendor",
                  searchAfter: 6,
                  value: lowStockVendorFilter,
                  onChange: (v) => {
                    setLowStockVendorFilter(v as string);
                    setLowStockPage(1);
                  },
                  options: [
                    { value: "all", label: "All vendors" },
                    ...lowStockVendors.map((v) => ({ value: v, label: v.split(" (")[0] })),
                  ],
                },
              ]}
              density={lowStockDensity}
              onDensityChange={setLowStockDensity}
              columns={LOW_STOCK_COLUMNS}
              hiddenColumns={lowStockHiddenCols}
              onColumnToggle={(id) => toggleInSet(setLowStockHiddenCols, id)}
              onReset={() => {
                setLowStockSearch("");
                setLowStockVendorFilter("all");
                setLowStockHiddenCols(new Set());
                setLowStockDensity("condensed");
                setLowStockPage(1);
              }}
            />
            <LowStockTable
              items={lowStockPageItems}
              density={lowStockDensity}
              hiddenColumns={lowStockHiddenCols}
              onCreatePO={onCreatePO}
              onCreateDemandPOForLowStockItem={openCreatePOForLowStockItem}
            />
            <PaginationFooter
              page={lowStockPage}
              pageCount={lowStockPageCount}
              onChange={setLowStockPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        </section>
      )}

      {/* ═════════ STALE POs TAB ═════════ */}
      {activeDemandsTab === "stale" && (
        <section className="flex flex-col gap-3" data-stale>
          <DemandInfoBanner icon={FileWarning}>
            Draft POs untouched for 7+ days. Send, archive, or reassign them so they don't
            slip through.
          </DemandInfoBanner>
          <div className="border border-border rounded-lg bg-card flex flex-col min-h-0 overflow-clip">
            {/* renderDemandsTabsRow() removed — sub-tab strip retired */}
            <DemandTableToolbar
              searchPlaceholder="Search PO# or vendor..."
              search={staleSearch}
              onSearchChange={setStaleSearch}
              countLabel={
                filteredStalePOs.length === stalePOs.length
                  ? `${stalePOs.length} stale POs`
                  : `${filteredStalePOs.length} of ${stalePOs.length} stale POs`
              }
              filterGroups={[
                {
                  key: "status",
                  title: "PO Status",
                  subtitle: "Filter stale POs by their current state",
                  value: staleStatusFilter,
                  onChange: (v) => setStaleStatusFilter(v as string),
                  options: [
                    { value: "all", label: "All", count: stalePOs.length },
                    { value: "Draft", label: "Draft", count: stalePOs.filter((p) => p.status === "Draft").length, dotColor: "var(--status-draft-text)" },
                    { value: "Sent", label: "Sent", count: stalePOs.filter((p) => p.status === "Sent").length, dotColor: "var(--status-sent-text)" },
                  ],
                },
              ]}
              density={staleDensity}
              onDensityChange={setStaleDensity}
              columns={STALE_PO_COLUMNS}
              hiddenColumns={staleHiddenCols}
              onColumnToggle={(id) => toggleInSet(setStaleHiddenCols, id)}
              onReset={() => {
                setStaleSearch("");
                setStaleStatusFilter("all");
                setStaleHiddenCols(new Set());
                setStaleDensity("condensed");
              }}
            />
            <StalePOsTable
              stalePOs={filteredStalePOs}
              density={staleDensity}
              hiddenColumns={staleHiddenCols}
              onNavigatePO={onNavigatePO}
              onCreatePO={onCreatePO}
            />
          </div>
        </section>
      )}

      {/* The Cause modal and Item Detail modal were retired —
         every row interaction now opens the Sandbox directly via
         `onPlanInSandbox`. The Sandbox carries the chart, transaction
         stream, item details disclosure and planning workspace in one
         surface, so the separate read-only modals no longer add value. */}

      {/* ═════════ ORDER FLOW MODAL ═════════
         Mounted once at the page level. Opens when a buyer clicks the main
         "+ Create PO" CTA on an All-Demand row, pre-filled with that item's
         aggregated demand and consolidation context. */}
      <OrderFlow
        open={orderFlowOpen}
        onOpenChange={(o) => {
          setOrderFlowOpen(o);
          if (!o) {
            setOrderFlowItem(null);
            setOrderFlowDemand(undefined);
          }
        }}
        item={orderFlowItem}
        mode="buy-now"
        prefill={
          orderFlowDemand
            ? { vendorQty: orderFlowDemand.totalQty }
            : null
        }
        onComplete={handleOrderFlowComplete}
        demandContext={orderFlowDemand}
      />

      {/* ── Recommend POs Modal ──
         Batch surface materialising the Phase 6 recommendation engine
         across every in-scope item from the listing. Hosts editable
         per-line qty + ship-by, surfaces conflicts inline, and creates
         Draft POs grouped per vendor via the same path the Sandbox's
         Execute uses. Drafts only — Execute never sends. */}
      <RecommendedPOsModal
        open={recommendModalOpen}
        onClose={() => setRecommendModalOpen(false)}
        inputs={recommendModalInputs}
      />

      {/* ── Item Quick View ──
         The catalogue / Parts item detail modal, reused verbatim. Opens
         when a buyer clicks an item thumbnail in the listing (card or
         table view). */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

      {/* ── Item transaction ledger drawer (E2) ──
         Opens when a buyer clicks a data cell in a demand row. A read-only
         peek at the item's stock movements (Creation = supply, Consumption =
         demand) with the band-coloured running on-hand. The item name +
         thumbnail still open QuickView; the Sandbox CTA still adds. */}
      <Sheet open={txnItem !== null} onOpenChange={(open) => { if (!open) setTxnItem(null); }}>
        <SheetContent side="right" className="w-full p-0 gap-0 sm:max-w-5xl shadow-2xl bg-white [&>button]:hidden">
          {txnItem && txnDrawerData && (
            <div className="flex h-full flex-col">
              {/* Header — mirrors InsightsDrawer (ContactsDirectoryPage) one for
                 one: accent-tinted icon tile · title · one-line subtitle · padded
                 hover close on the right. No hairline border — the drawer body
                 supplies its own top spacing so the header reads as part of the
                 same surface, not a stacked cap. */}
              <SheetHeader className="shrink-0 flex-row items-start justify-between gap-3 px-5 pt-5 pb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "hsl(var(--accent))" }}
                  >
                    <Package className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-base text-foreground leading-tight" style={{ fontWeight: 600 }}>
                      {txnItem.itemName}
                    </SheetTitle>
                    <SheetDescription className="text-[13px] text-muted-foreground mt-0.5">
                      {txnItem.itemCode} · Every stock-changing event for this item
                    </SheetDescription>
                  </div>
                </div>
                <SheetClose className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1 shrink-0">
                  <X className="w-4 h-4 text-muted-foreground" />
                  <span className="sr-only">Close</span>
                </SheetClose>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
                <UnifiedTransactionStream
                  demandEvents={txnDrawerData.demandEvents}
                  incomingEvents={txnDrawerData.incomingEvents}
                  poByNumber={txnDrawerData.poByNumber}
                  baseUom={txnItem.baseUom}
                  startingBalance={txnItem.onHand - txnItem.quarantined}
                  minLevel={txnItem.minLevel}
                  maxLevel={txnItem.maxLevel}
                  draftIncoming={txnDrawerData.draftIncoming}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Multi-PO Preview Modal ──
         Opens when bulk Create POs is clicked. Shows the buyer exactly
         what we're about to draft (one PO per default vendor, with
         outstanding-demand quantities) and lets them uncheck any vendor
         they don't want before confirming. Pressing Create POs actually
         calls createPOFromVendorCheckout for each checked entry. */}
      <Dialog open={!!multiPOModal} onOpenChange={(open) => { if (!open) setMultiPOModal(null); }}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          {multiPOModal && (() => {
            const { previews } = multiPOModal;
            const checkedCount = previews.filter((p) => multiPOChecked.has(p.key)).length;
            return (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
                  <div
                    className="flex items-center justify-center size-10 rounded-md shrink-0"
                    style={{ backgroundColor: "#EDF4FF" }}
                  >
                    <Plus className="size-5" style={{ color: "#0A77FF" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle>Create Purchase Orders</DialogTitle>
                    <DialogDescription className="mt-0.5">
                      We'll draft {previews.length} {previews.length === 1 ? "PO" : "POs"} — one per default vendor.
                    </DialogDescription>
                  </div>
                </div>

                {/* Educational banner — explains the auto-decisions so the
                   buyer knows exactly what each draft will contain. */}
                <div
                  className="mx-5 mt-3 rounded-lg border-l-[3px] flex items-start gap-3 px-3 py-2.5"
                  style={{ backgroundColor: "#F5F3FF", borderLeftColor: "#7C3AED" }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#EDE9FE" }}
                  >
                    <Info className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
                  </div>
                  <div
                    className="min-w-0 text-[11.5px] leading-snug"
                    style={{ color: "#475569", fontFamily: FONT }}
                  >
                    Each PO is assigned to the item's <strong style={{ color: "#334155" }}>default vendor</strong>,
                    and order quantities match the <strong style={{ color: "#334155" }}>outstanding demand</strong>{" "}
                    rolled up from sales orders and low-stock signals.
                    You can change vendor or quantity inside any draft before sending.
                  </div>
                </div>

                {/* Preview list */}
                <div className="px-5 py-3 flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
                  {previews.map((p) => {
                    const isChecked = multiPOChecked.has(p.key);
                    return (
                      <label
                        key={p.key}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors hover:bg-secondary/60"
                        style={{
                          backgroundColor: isChecked ? "hsl(var(--secondary))" : "transparent",
                          border: "1px solid hsl(var(--border))",
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => {
                            setMultiPOChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.key)) next.delete(p.key);
                              else next.add(p.key);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground truncate" style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                              {p.vendor}
                            </span>
                            <span
                              className="inline-flex items-center px-1.5 py-0 rounded text-[10px] uppercase tracking-wide"
                              style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}
                            >
                              Default
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", fontFamily: FONT }}>
                              ${p.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-muted-foreground" style={{ fontSize: 11, fontFamily: FONT }}>
                              {p.itemCount} item{p.itemCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4"
                    onClick={() => setMultiPOModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 px-4 gap-1.5"
                    disabled={checkedCount === 0}
                    onClick={confirmBulkCreatePOs}
                  >
                    <Plus className="size-3.5" />
                    Create PO{checkedCount === 1 ? "" : "s"}{checkedCount > 0 ? ` (${checkedCount})` : ""}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* ─────────── Sub-components ─────────── */

/* ── Design constants, lifted 1:1 from PurchaseOrdersListing.tsx / PODataTable.tsx
   to keep the visual language identical across the app. ─────────── */

/** Hairline divider between sticky and scrollable columns — PO spec */
const FROZEN_LEFT_SHADOW = "inset -1px 0 0 0 rgba(0,0,0,0.08)";
const FROZEN_RIGHT_SHADOW = "inset 1px 0 0 0 rgba(0,0,0,0.08)";

/** Slate-50 header background (hardcoded in PO source) */
const HEADER_BG = "rgb(248, 250, 252)";

/** Header cell — 13px / weight 500 / muted-fg / title-case (NOT uppercase).
   Aligned with the Partners listing table for visual parity: slightly
   bumped from 12px → 13px and weight 400 → 500 for cleaner scannability,
   keeping the muted-foreground tone so headers don't compete with cell
   content. */
const HEADER_TH_BASE = "text-[13px] whitespace-nowrap";
const HEADER_FONT: React.CSSProperties = {
  fontWeight: 500,
  color: "hsl(var(--muted-foreground))",
  fontFamily: FONT,
};

/** Row hover color (PO source = hardcoded #F0F7FF) */
const ROW_HOVER_BG = "#F0F7FF";

/** Search-match highlighter — wraps occurrences of `query` inside `text`
    with a pale-yellow <mark>, matching the Partners listing's highlight
    design (#FEFCE8 background / #854D0E text, weight 500). Returns the raw
    text untouched when there's no query or no match, so non-matching cells
    render exactly as before. Case-insensitive; the query is regex-escaped. */
function highlightMatch(text: string | undefined | null, query: string): React.ReactNode {
  if (!text) return text ?? null;
  const q = (query || "").trim();
  if (!q) return text;
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-transparent px-0.5 rounded-sm"
            style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/* ── Procurement Planning table column model ──
   Mirrors the Purchase Orders table (PODataTable): the middle columns are
   reorderable + resizable; Item (left) and Actions (right) stay pinned at
   the frozen edges. `minWidth` seeds the resizable width and floors it. */
const ITEM_COL_W = 200;
const ACTIONS_COL_W = 150;
/* Leftmost selection checkbox column — Partners-directory pattern. Sticky at
   left:0; the Item column freezes just after it (offset by this width). */
const SELECT_COL_W = 44;
/* Per-band explanation shown on the Issues-cell pill (hover tooltip). */
const BAND_HINT: Record<string, string> = {
  "below-max":
    "Stock is below the maximum level but still healthy. Demand is still fully covered, so the only impact is a shrinking buffer above the minimum. No action needed yet. This is an early signal to plan ahead.",
  "below-min":
    "Stock has fallen to the minimum level set for this item. Current demand can still be met, but the safety buffer is gone, so any delay in resupply or rise in demand will cause a stockout. Order now, before it runs out.",
  "below-zero":
    "Stock has gone negative. Demand is higher than the units on hand, so some orders cannot be fulfilled until the item is restocked. Sales orders and production that depend on this item are blocked or delayed. Act immediately.",
  "above-max":
    "Stock is projected to sit above the maximum level — capital tied up in inventory that isn't going to move. Common cause: an SO cancelled or a BOM changed after the order was already committed. Consider deferring or cancelling upstream POs.",
};

/* Default order follows Nophil's brief: Issues before Gap ("what's wrong"
   before "how much"). Users can still reorder via the draggable headers. */
/* Acquisition method pill — Purchased (blue) / Manufactured (amber). Tokens
   mirror items-v3 in nimble-palette so both products speak the same visual
   language. When an item has both methods, each pill renders filled at full
   tint (no outline-only secondary), matching items-v3's AcquisitionMethodsList. */
function AcquisitionPill({ method, secondary = false }: { method: AcquisitionMethod; secondary?: boolean }) {
  const purchased = method === "Purchased";
  const tone = purchased
    ? { bg: "#EFF6FF", fg: "#1E40AF", border: "#DBEAFE" }
    : { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" };
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: tone.bg,
        color: tone.fg,
        borderColor: tone.border,
        fontFamily: FONT,
      }}
      title={secondary ? `Secondary acquisition: ${method}` : `Primary acquisition: ${method}`}
    >
      {method}
    </span>
  );
}

const MIDDLE_COL_IDS: string[] = ["description", "gapIssue", "currentAtp", "sources", "needBy", "owner", "acquisition"];
const MIDDLE_COL_META: Record<string, { label: string; minWidth: number; sortKey: string; align: "left" | "right"; hint?: string; formula?: string; note?: string; note2?: string; bands?: { label: string; color: string; desc: string }[] }> = {
  description: { label: "Description", minWidth: 280, sortKey: "description", align: "left" },
  /* `hint` surfaces as an (i) tooltip on the header (see renderMiddleHeader),
     mirroring the Partners directory's shadcn Tooltip pattern. */
  /* Merged Gap + Issue column (Nophil/Eli #8): one cell carries the severity
     band (the dotted pill) and the signed gap together. Color encodes
     severity; the number carries magnitude. Sorts by the gap value; the
     `bands` legend still surfaces in the header (i) tooltip. */
  gapIssue: {
    label: "Issues",
    minWidth: 220,
    sortKey: "gap",
    align: "left",
    hint: "Shows how far stock has dropped below its set levels: below maximum, below minimum, or below zero.",
  },
  /* ATP column. Header reads "Available to promise" (Areeb, 2026-06-24 — was
     "As of today" per Nophil's earlier guidance); the hover still explains it's
     a today-only snapshot, so the as-of-today nuance isn't lost. ATP is always
     as-of-today, never recomputed for the filtered period. */
  currentAtp: {
    label: "Available to promise",
    minWidth: 190,
    sortKey: "atp",
    align: "right",
    hint: "The number of units you can still promise to new sales orders or quotes today, after the demand already committed on open sales orders, quotes, and stock on hold is set aside. It's a snapshot of today only and does not count incoming supply.",
  },
  sources: {
    label: "Sources",
    minWidth: 180,
    sortKey: "sources",
    align: "left",
    hint: "Sources show which events are generating demand for this item. Sources can be sales orders or low inventory stocks.",
  },
  needBy: { label: "Need by", minWidth: 140, sortKey: "needBy", align: "left" },
  owner: { label: "Purchasing Owner", minWidth: 190, sortKey: "owner", align: "left" },
  acquisition: { label: "Acquisition", minWidth: 150, sortKey: "acquisition", align: "left", hint: "How this item is obtained. Purchased items come from a vendor. Manufactured items are built in-house. An item can be both, in which case a secondary method is shown." },
};

function ByItemView({
  items,
  selectedItems,
  showSelect = true,
  density,
  cardView,
  cardSize,
  hiddenColumns,
  columnOrder,
  sortBy,
  sortDir,
  onSort,
  onSetSort,
  onHideColumn,
  onToggleSelect,
  onToggleSelectMany,
  onCreatePO,
  onCreateDemandPO,
  onCreateDemandPOForSource,
  projectionByItemCode,
  bandByItemCode,
  ownerByItemCode,
  acquisitionByItemCode,
  onPlanInSandbox,
  onOpenItemQuickView,
  onOpenTransactions,
  searchQuery,
  onColumnOrderChange,
}: {
  items: DemandItem[];
  selectedItems: Set<string>;
  /** Show the sticky-left selection checkbox column + enable bulk multi-add.
      Off in the first-time flow (single-item planning via the row CTA). */
  showSelect?: boolean;
  density: "condensed" | "comfort";
  /** When true, render the Partners-style card grid instead of the table. */
  cardView?: boolean;
  /** Card sizing — grid columns / padding / image size. Defaults to medium. */
  cardSize?: CardSize;
  hiddenColumns?: Set<string>;
  /** Drawer-driven order for the middle columns. Item + Actions stay
      pinned at the table's sticky edges regardless of this order. */
  columnOrder?: string[];
  /** Active sort column key + direction (per-column sorting). The
      special key "default" means category grouping + most-severe-first. */
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  /** Direct setter used by the Partners-style column header menu — sets
      both key and direction explicitly (menu items are "Sort ascending" /
      "Sort descending", not a toggle). Falls back to `onSort` when
      omitted so older call sites keep the click-to-toggle behavior. */
  onSetSort?: (key: string, direction: "asc" | "desc") => void;
  /** Hide a middle column from the header menu (Item / Actions are locked
      and never appear in the menu). Wired to the same `allHiddenCols` set
      that the Columns drawer manages. */
  onHideColumn?: (columnKey: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany?: (ids: string[], select: boolean) => void;
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
  /** Main row CTA — opens the OrderFlow modal with full demand context. */
  onCreateDemandPO?: (item: DemandItem) => void;
  /** Per-source CTA inside the expanded panel — opens OrderFlow scoped
      to a single demand source so the banner reads e.g. "Creating PO
      for Sales Order SO-10428". Vendor stays pre-filled from the item. */
  onCreateDemandPOForSource?: (item: DemandItem, source: DemandSource) => void;
  /** Forward-looking ATP projection per item — feeds the ATP column and
      the Issues column (issue date). Items absent from the map (no
      matching planner record) render "—" in dependent columns. */
  projectionByItemCode?: Map<string, { worstSeverity: PlannerSeverity; firstViolation: string | null; currentAtp: number; baseUom: string }>;
  /** Band lookup per item — drives the Issues cell (band label) and the
      most-severe-first default sort. Healthy / no-planner items map to
      null. */
  bandByItemCode?: Map<string, LevelBand | null>;
  /** Purchasing owner per item (planner registry) — drives the Owner
      cell (avatar + name, hover card). Items without a record render
      "—". */
  ownerByItemCode?: Map<string, { owner: string; ownedByMe: boolean }>;
  /** Acquisition method per item (synthesized) — drives the Acquisition
      cell. Primary + optional secondary make-or-buy method. */
  acquisitionByItemCode?: Map<string, ItemAcquisition>;
  /** Hand-off to the Procurement Planner Sandbox — the single landing
      surface for any row interaction (item code + the Plan PO
      button funnel here). */
  onPlanInSandbox?: (itemCode: string) => void;
  /** Opens the QuickViewPanel item modal (catalogue / Parts pattern) when a
      buyer clicks an item thumbnail. */
  onOpenItemQuickView?: (item: DemandItem) => void;
  /** Opens the per-item transaction ledger drawer (E2) when a buyer clicks a
      data cell in the row. Name + thumbnail keep routing to QuickView. */
  onOpenTransactions?: (itemCode: string) => void;
  /** Active global search query — used to yellow-highlight matched text in
      the item code + description cells (Partners highlight pattern). */
  searchQuery?: string;
  /** Persist a new middle-column order after a header drag (PO table parity).
      Accepts the setState updater form so live-swaps read the latest order. */
  onColumnOrderChange?: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const hidden = hiddenColumns || new Set<string>();
  const isVisible = (id: string) => !hidden.has(id);

  /* ── Column widths + header drag/resize (Purchase Orders table parity) ──
     Mirrors PODataTable's interaction grammar: a 5px-threshold mousedown
     live-swap for reorder and an edge-drag for resize, with widths held in
     local state. Item (left) + Actions (right) stay pinned — they carry no
     data-col-drag-key, so they're never drag targets or resizable. */
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    MIDDLE_COL_IDS.forEach((id) => { w[id] = MIDDLE_COL_META[id].minWidth; });
    return w;
  });
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);
  const colDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  /* Partners-style per-column freeze — middle columns the buyer pins to the
     left edge so they don't scroll horizontally with the rest. Item is
     structurally sticky-left and is not part of this set (it's always
     pinned); Actions is structurally sticky-right and is never freezable. */
  const [frozenMiddleColumns, setFrozenMiddleColumns] = useState<Set<string>>(
    () => new Set(),
  );
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenMiddleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  /* Bridge the ColumnHeaderMenu's explicit-direction sort onto the parent's
     click-to-toggle `onSort`. When the menu offers "Sort ascending / Sort
     descending" the buyer expects the direction to be set, not toggled. */
  const menuOnSort = useCallback(
    (key: string, direction: "asc" | "desc" | null) => {
      if (direction === null) {
        // "Untoggle" from the menu returns to default (category grouping).
        if (onSetSort) onSetSort("default", "asc");
        else onSort("default");
        return;
      }
      if (onSetSort) {
        onSetSort(key, direction);
      } else {
        // Fallback: toggle via onSort until we land on the requested direction.
        if (sortBy !== key) onSort(key);
        if (sortDir !== direction) onSort(key);
      }
    },
    [onSetSort, onSort, sortBy, sortDir],
  );

  /* Sandbox naming — three states, three labels, used everywhere a sandbox
     affordance appears so the wording stays consistent:
       · "Sandbox this item" when the item isn't in the session yet
         (whether or not a session already exists),
       · "Open in sandbox" for an item already in the session (its planning
         state also surfaces in the table — Nophil sandbox #6). */
  const openPlannerItems = useOpenPlannerItems();
  const sandboxActionFor = (itemCode: string) => {
    const planning = openPlannerItems.includes(itemCode);
    const hasSandbox = openPlannerItems.length > 0;
    return {
      label: planning ? "Open in sandbox" : "Sandbox this item",
      /* The first add (no session yet) is the primary (blue) CTA; adding to an
         existing session and "Open in sandbox" use the Partners secondary
         button (variant="secondary"). No icon / dot — just the label. */
      secondary: planning || hasSandbox,
      planning,
    };
  };

  const handleResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = columnWidths[colId] ?? MIDDLE_COL_META[colId]?.minWidth ?? 150;
    resizeRef.current = { colId, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const min = MIDDLE_COL_META[resizeRef.current.colId]?.minWidth ?? 80;
      setColumnWidths((p) => ({
        ...p,
        [resizeRef.current!.colId]: Math.max(min, resizeRef.current!.startW + ev.clientX - resizeRef.current!.startX),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [columnWidths]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (e.button !== 0) return;
    colDragRef.current = { columnKey, startX: e.clientX, startY: e.clientY, isDragging: false, lastSwapTime: 0 };
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
        if (!k || k === draggedKey) break;
        onColumnOrderChange?.((prev) => {
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
  }, [onColumnOrderChange]);

  /* colSpan for the empty-state row — the data columns (item ·
     description · gap · atp · sources · issues · needBy · owner) +
     actions, minus any the buyer hid via the Columns menu. */
  const visibleColCount =
    (showSelect ? 1 : 0) /* select checkbox */ +
    (isVisible("item") ? 1 : 0) +
    (isVisible("description") ? 1 : 0) +
    (isVisible("gapIssue") ? 1 : 0) +
    (isVisible("currentAtp") ? 1 : 0) +
    (isVisible("sources") ? 1 : 0) +
    (isVisible("needBy") ? 1 : 0) +
    (isVisible("owner") ? 1 : 0) +
    1 /* actions */;
  /* Page-level selection state for the header select-all checkbox. */
  const pageIds = items.map((i) => i.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedItems.has(id));
  const somePageSelected = pageIds.some((id) => selectedItems.has(id));
  /* No system-driven ordering. Rows arrive already sorted by the parent
     (category grouping + most-severe-first by default, or the column the
     buyer clicked). The manager decides what matters — the table never
     re-pins or re-ranks behind their back. */
  const orderedItems = items;

  const rowPad = density === "condensed" ? "[&>td]:py-1" : "[&>td]:py-2";
  // Header padding mirrors the cell padding (`pl-4 pr-4`).
  const thHeight = "[&>th]:h-8 [&>th]:pl-4 [&>th]:pr-4";

  /* Sticky-left + sticky-right header cell helper */
  const stickyHeader = (left: number | "auto", isLast = false): React.CSSProperties => ({
    position: "sticky",
    left: left === "auto" ? undefined : left,
    right: left === "auto" ? 0 : undefined,
    zIndex: 30,
    backgroundColor: HEADER_BG,
    ...(isLast
      ? { boxShadow: left === "auto" ? FROZEN_RIGHT_SHADOW : FROZEN_LEFT_SHADOW }
      : {}),
  });

  /* Middle columns render in the drawer-chosen order; Item (sticky-left)
     and Actions (sticky-right) are pinned at the edges and never reorder.
     Any middle id missing from columnOrder is appended in default order,
     then the list is filtered to the visible columns. */
  const orderedMiddle =
    columnOrder && columnOrder.length > 0
      ? columnOrder.filter((id) => MIDDLE_COL_IDS.includes(id))
      : MIDDLE_COL_IDS;
  const middleOrder = [
    ...orderedMiddle,
    ...MIDDLE_COL_IDS.filter((id) => !orderedMiddle.includes(id)),
  ].filter((id) => isVisible(id));

  /* Cumulative left offset for each frozen middle column. Frozen columns
     pin next to the Item column (which is already structurally sticky-left
     at offset `SELECT_COL_W + ITEM_COL_W`), and each subsequent frozen
     column adds its own width to the stack. Non-frozen columns between two
     frozen ones scroll under — same behavior as the Contacts directory. */
  const frozenBaseLeft = (showSelect ? SELECT_COL_W : 0) + (isVisible("item") ? ITEM_COL_W : 0);
  const frozenMiddleOffsets: Record<string, number> = {};
  {
    let acc = frozenBaseLeft;
    middleOrder.forEach((id) => {
      if (frozenMiddleColumns.has(id)) {
        frozenMiddleOffsets[id] = acc;
        acc += columnWidths[id] ?? MIDDLE_COL_META[id]?.minWidth ?? 0;
      }
    });
  }
  /* The right-most frozen column carries the shadow so the freeze edge is
     visually obvious (matches Item's frozen-left shadow). */
  const lastFrozenMiddleId = [...middleOrder].reverse().find((id) => frozenMiddleColumns.has(id)) ?? null;

  /* Middle-column header — a Purchase-Orders-style draggable header:
     grip on hover + cursor-grab, click-to-sort with a two-arrow indicator,
     and an edge resize handle. `data-col-drag-key` makes it a drag/drop
     target for the live-swap reorder. */
  const renderMiddleHeader = (id: string) => {
    const meta = MIDDLE_COL_META[id];
    if (!meta) return null;
    const active = sortBy === meta.sortKey;
    const isDragged = draggingColumnKey === id;
    const isFrozen = frozenMiddleColumns.has(id);
    const frozenLeft = isFrozen ? frozenMiddleOffsets[id] : undefined;
    const isLastFrozen = isFrozen && lastFrozenMiddleId === id;
    return (
      <TableHead
        data-col-drag-key={id}
        onMouseDown={(e) => handleHeaderMouseDown(e, id)}
        onClickCapture={(e) => {
          if (suppressNextClickRef.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className={`group/colheader relative select-none cursor-grab ${meta.align === "right" ? "text-right" : "text-left"}`}
        style={{
          ...HEADER_FONT,
          fontSize: "12px",
          whiteSpace: "nowrap",
          width: columnWidths[id] ?? meta.minWidth,
          padding: "1px 8px 1px 24px",
          overflow: "hidden",
          ...(isFrozen
            ? {
                position: "sticky",
                left: frozenLeft,
                zIndex: 25,
                backgroundColor: HEADER_BG,
                ...(isLastFrozen ? { boxShadow: FROZEN_LEFT_SHADOW } : {}),
              }
            : {}),
          ...(isDragged
            ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" }
            : {}),
        }}
      >
        {isDragged && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full pointer-events-none"
            style={{ backgroundColor: "hsl(var(--primary))" }}
          />
        )}
        <GripVertical
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${
            isDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"
          }`}
        />
        {/* Partners-style column menu — click the label to open Sort / Hide /
            Freeze. Drag-to-reorder still fires from mousedown-move on the
            outer TableHead; `suppressNextClickRef` blocks the click that
            would otherwise open the popover after a drag. */}
        <ColumnHeaderMenu
          columnKey={meta.sortKey}
          label={meta.label}
          sortable
          sortConfig={
            (active ? { key: meta.sortKey, direction: sortDir } : null) as CMSortConfig | null
          }
          onSort={menuOnSort}
          onHideColumn={() => onHideColumn?.(id)}
          onFreezeColumn={() => handleFreezeColumn(id)}
          isFrozen={isFrozen}
        >
          <div
            className={`flex items-center gap-1.5 select-none ${meta.align === "right" ? "justify-end w-full" : ""}`}
          >
            <span style={active ? { color: "hsl(var(--primary))" } : undefined}>
              {meta.label}
            </span>
            {meta.hint && (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex shrink-0 cursor-default text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Info className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[300px] text-[11px] z-[300]">
                  {id === "currentAtp" ? (
                    /* INVENTORY SNAPSHOT layout — the ATP column
                       header's tooltip mirrors the Sales Order
                       module's snapshot design. Hierarchy: Allocated
                       & Quarantined nested under On-Hand; Demand
                       nested under Available; ATP row highlighted;
                       two formula lines at the bottom. Illustrative
                       counts (3 / 0 / 0 / 3 / 0 / 3 / 3) — this is
                       a column-header explainer, not tied to a
                       specific row. Restored 2026-07-15 (buyer:
                       "do you remember when I asked you to update
                       the ATP copy to this?"). */
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        <Package className="h-3 w-3" />
                        Inventory Snapshot
                      </div>
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center justify-between font-semibold">
                          <span>On-Hand</span>
                          <span className="tabular-nums">3</span>
                        </div>
                        <div className="flex items-center justify-between pl-3 opacity-80">
                          <span>Allocated</span>
                          <span className="tabular-nums">0</span>
                        </div>
                        <div className="flex items-center justify-between pl-3 opacity-80">
                          <span>Quarantined</span>
                          <span className="tabular-nums">0</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold pt-1">
                          <span>Available</span>
                          <span className="tabular-nums">3</span>
                        </div>
                        <div className="flex items-center justify-between pl-3 opacity-80">
                          <span>Demand</span>
                          <span className="tabular-nums">0</span>
                        </div>
                        <div
                          className="mt-1 flex items-center justify-between rounded-md px-2 py-1 font-semibold"
                          style={{
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "#10B981",
                          }}
                        >
                          <span>ATP (Available-to-Promise)</span>
                          <span className="tabular-nums">3</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold pt-1">
                          <span>Projected Available</span>
                          <span className="tabular-nums">3</span>
                        </div>
                      </div>
                      <div className="space-y-0.5 border-t border-white/15 pt-2 font-mono text-[10px] opacity-80">
                        <p>ATP = On-Hand − Quarantined − Demand</p>
                        <p>Projected = Available + Incoming − Demand</p>
                      </div>
                    </div>
                  ) : (
                    <p>{meta.hint}</p>
                  )}
                  {meta.formula && (
                    <p className="mt-1.5 font-mono text-[10px] opacity-90">{meta.formula}</p>
                  )}
                  {meta.note && <p className="mt-1.5 opacity-80">{meta.note}</p>}
                  {meta.note2 && <p className="mt-1.5 opacity-80">{meta.note2}</p>}
                  {meta.bands && (
                    <div className="mt-2 space-y-1.5 border-t border-white/15 pt-2">
                      {meta.bands.map((b) => (
                        <div key={b.label} className="flex items-start gap-1.5">
                          <span
                            className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: b.color }}
                          />
                          <p>
                            <span className="font-semibold">{b.label}:</span>{" "}
                            <span className="opacity-80">{b.desc}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
            {active
              ? sortDir === "asc"
                ? <ArrowUp className="size-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                : <ArrowDown className="size-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
              : <ArrowUpDown className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-60 transition-opacity" />}
          </div>
        </ColumnHeaderMenu>
        <div
          className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize opacity-0 group-hover/colheader:opacity-100 hover:!opacity-100 transition-opacity z-10"
          style={{ backgroundColor: "hsl(var(--border))" }}
          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, id); }}
          onClick={(e) => e.stopPropagation()}
        />
      </TableHead>
    );
  };

  const renderMiddleCell = (id: string, item: DemandItem, gap: number) => {
    switch (id) {
      case "description":
        return (
          <TableCell
            className="text-sm max-w-[280px] truncate"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            {highlightMatch(item.itemName, searchQuery || "")}
          </TableCell>
        );
      case "gapIssue": {
        /* Merged Gap + Issue: a single tinted pill combines the band label and
           the signed magnitude in one label — e.g. "Below zero -7EA",
           "Above Maximum +48EA". Pill tone carries the severity; healthy
           items (no band) fall back to the plain signed gap number.
           2026-07-14: above-max branch computes its OWN delta (currentAtp
           − maxLevel) instead of reusing the demand-based `gap`, because
           overstock is a delta against the CEILING, not a shortfall
           against demand. Fixes the "green +32 / red 8" confusion where
           above-max items were rendering with the wrong colour + no
           label. */
        const band = bandByItemCode?.get(item.itemCode) ?? null;
        const proj = projectionByItemCode?.get(item.itemCode);
        const plannerItem = PLANNER_ITEMS.find((p) => p.itemCode === item.itemCode);
        const tone =
          band === "below-zero"
            ? { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" }
            : band === "below-min"
              ? { bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA" }
              /* Teal — same fresh tone as the scope-bar Above Max dot +
                 graph zone + tx band. */
              : band === "above-max"
                ? { bg: "#F0FDFA", fg: "#115E59", border: "#5EEAD4" }
                : band === "below-max"
                  ? { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" }
                  : null;
        /* Above-max carries a POSITIVE surplus vs the ceiling. Every
           other band keeps the demand-based `gap`. */
        const overshoot =
          band === "above-max" && proj && plannerItem
            ? proj.currentAtp - plannerItem.maxLevel
            : null;
        const magnitudeForPill = overshoot != null ? overshoot : gap;
        const gapText = `${magnitudeForPill > 0 ? "+" : ""}${Math.abs(magnitudeForPill)}${item.uom}`;
        return (
          <TableCell className="whitespace-nowrap">
            {band && tone ? (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] cursor-default tabular-nums"
                    style={{ backgroundColor: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, fontWeight: 600, fontFamily: FONT }}
                  >
                    {bandLabel(band)} {gapText}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11px] z-[300]">
                  {BAND_HINT[band]}
                </TooltipContent>
              </Tooltip>
            ) : (
              /* Healthy row (no live band). Buyer feedback 2026-07-20:
                 "the Issues column for those items will have nothing
                 in it" — render a muted em-dash so it reads as "no
                 issue" at a glance, not a zero / gap number that
                 could be misread. Matches the em-dash used in every
                 other "no value" cell across the listing (needBy,
                 owner, currentAtp, sources). */
              <span
                className="text-sm"
                style={{ color: "hsl(var(--muted-foreground))", fontWeight: 500, fontFamily: FONT }}
                title="No issue — item is comfortably within its stocking range"
              >
                —
              </span>
            )}
          </TableCell>
        );
      }
      case "currentAtp": {
        const proj = projectionByItemCode?.get(item.itemCode);
        if (!proj) {
          return (
            <TableCell className="text-right text-sm whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT, paddingRight: 44 }}>
              —
            </TableCell>
          );
        }
        return (
          <TableCell
            className="text-right text-sm tabular-nums whitespace-nowrap"
            style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT, paddingRight: 44 }}
          >
            {proj.currentAtp.toLocaleString()}{" "}
            <span style={{ fontWeight: 400, color: "hsl(var(--muted-foreground))", fontSize: 11 }}>
              {proj.baseUom}
            </span>
          </TableCell>
        );
      }
      case "sources": {
        /* Healthy row (band=null) → render "—" alongside the Issues
           column's "—" so the buyer reads the row as "nothing going
           on" at a glance. Buyer feedback 2026-07-20: "in listing
           table we will not see any issues and sources data" for
           items surfaced by the "Include items without issues"
           toggle. */
        const band = bandByItemCode?.get(item.itemCode) ?? null;
        if (band == null) {
          return (
            <TableCell className="text-sm" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT, paddingLeft: 36 }}>
              —
            </TableCell>
          );
        }
        const soDocs = item.sources.filter((s) => s.kind === "SO");
        const prDocs = item.sources.filter((s) => s.kind === "Request");
        if (soDocs.length + prDocs.length === 0) {
          return (
            <TableCell className="text-sm" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT, paddingLeft: 36 }}>
              —
            </TableCell>
          );
        }
        return (
          <TableCell className="whitespace-nowrap" style={{ paddingLeft: 36 }} onClick={(e) => e.stopPropagation()}>
            <CombinedSourcePill soDocs={soDocs} prDocs={prDocs} uom={item.uom} />
          </TableCell>
        );
      }
      /* "issues" was merged into the "gapIssue" case above (Nophil/Eli #8). */
      case "needBy": {
        const date = earliestNeedDate(item);
        if (!date) {
          return (
            <TableCell className="text-sm whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>
              —
            </TableCell>
          );
        }
        const days = Math.ceil(
          (new Date(`${date}T00:00:00`).getTime() - TODAY.getTime()) / 86400000,
        );
        const hint =
          days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`;
        const hintColor = days < 0 ? "#B91C1C" : days <= 7 ? "#C2410C" : "#94A3B8";
        return (
          <TableCell className="whitespace-nowrap">
            <div className="flex flex-col">
              <span className="text-sm" style={{ color: "hsl(var(--foreground))", fontFamily: FONT }}>
                {fmtNeedBy(date)}
              </span>
              <span className="text-[11px]" style={{ color: hintColor, fontWeight: 500, fontFamily: FONT }}>
                {hint}
              </span>
            </div>
          </TableCell>
        );
      }
      case "owner": {
        const own = ownerByItemCode?.get(item.itemCode);
        if (!own) {
          return (
            <TableCell className="text-sm whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>
              —
            </TableCell>
          );
        }
        return (
          <TableCell className="min-w-[170px]">
            <div className="flex items-center gap-2 min-w-0">
              <UserHoverCard name={own.owner}>
                <span className="shrink-0">
                  <AvatarCircle name={own.owner} size={32} />
                </span>
              </UserHoverCard>
              <span className="text-sm block truncate" style={{ fontFamily: FONT }} title={own.owner}>
                {own.owner}
                {own.ownedByMe && (
                  <span style={{ color: "hsl(var(--muted-foreground))" }}> (You)</span>
                )}
              </span>
            </div>
          </TableCell>
        );
      }
      case "acquisition": {
        const acq = acquisitionByItemCode?.get(item.itemCode);
        if (!acq) {
          return (
            <TableCell className="text-sm whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>
              —
            </TableCell>
          );
        }
        return (
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <AcquisitionPill method={acq.primary} />
              {acq.secondary && <AcquisitionPill method={acq.secondary} secondary />}
            </div>
          </TableCell>
        );
      }
      default:
        return null;
    }
  };

  /* ── Card view (Partners-style grid) ──
     Same Large / Medium / Small behavior as the Partners listing: size
     only changes the grid columns, card padding, and the item-image box —
     the card content is identical across all three. Column show/hide and
     the sticky Item/Actions edges don't apply here (the Columns control is
     disabled in card view, matching Partners). */
  if (cardView) {
    const size: CardSize = cardSize ?? "medium";
    const gridCols =
      size === "large"
        ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2"
        : size === "small"
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    const cardPad = size === "large" ? "p-5" : size === "small" ? "p-3" : "p-4";
    const imgBox = size === "large" ? "w-10 h-10" : size === "small" ? "w-7 h-7" : "w-8 h-8";

    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {orderedItems.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No demand gaps"
            description="No items match your current search or filters. Adjust the filters above or check back later."
          />
        ) : (
          <div className={`grid gap-4 ${gridCols}`}>
            {orderedItems.map((item) => {
              const gap = gapFor(item);
              const proj = projectionByItemCode?.get(item.itemCode);
              const band = bandByItemCode?.get(item.itemCode) ?? null;
              const own = ownerByItemCode?.get(item.itemCode);
              const soDocs = item.sources.filter((s) => s.kind === "SO");
              const prDocs = item.sources.filter((s) => s.kind === "Request");
              const needDate = earliestNeedDate(item);
              const tone =
                band === "below-zero"
                  ? { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" }
                  : band === "below-min"
                    ? { bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA" }
                    /* Above-max — teal, matches the row-level pill. */
                    : band === "above-max"
                      ? { bg: "#F0FDFA", fg: "#115E59", border: "#5EEAD4" }
                      : { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" };
              let needHint = "";
              let needHintColor = "#94A3B8";
              if (needDate) {
                const days = Math.ceil(
                  (new Date(`${needDate}T00:00:00`).getTime() - TODAY.getTime()) / 86400000,
                );
                needHint =
                  days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`;
                needHintColor = days < 0 ? "#B91C1C" : days <= 7 ? "#C2410C" : "#94A3B8";
              }
              return (
                <div
                  key={item.id}
                  // Card body is INERT — clicking no longer enters the sandbox.
                  // Detail opens from the thumbnail; adding is the explicit CTA
                  // in the card's actions menu.
                  className={`bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/20 transition-all ${cardPad}`}
                >
                  {/* Header — item image + code/name + actions menu */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail — opens the QuickViewPanel item modal,
                          the same pattern the catalogue / Parts section uses. */}
                      <div
                        className={`${imgBox} rounded-lg bg-muted overflow-hidden shrink-0 border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all`}
                        style={{ borderColor: "#E8ECF1" }}
                        title="View item details"
                        onClick={(e) => { e.stopPropagation(); onOpenItemQuickView?.(item); }}
                      >
                        <ImageWithFallback
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm truncate"
                          style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                          title={item.itemCode}
                        >
                          {highlightMatch(item.itemCode, searchQuery || "")}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          style={{ fontFamily: FONT }}
                          title={item.itemName}
                        >
                          {highlightMatch(item.itemName, searchQuery || "")}
                        </p>
                        {/* "In plan" tag — parity with the table view so the
                            card also reads at a glance as already in the
                            sandbox. */}
                        {sandboxActionFor(item.itemCode).planning && (
                          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <FlaskConical className="h-2.5 w-2.5" />
                            In plan
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
                          aria-label={`Actions for ${item.itemCode}`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => onPlanInSandbox?.(item.itemCode)}>
                          {sandboxActionFor(item.itemCode).label}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Badges — issue band + source pills */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px]"
                      style={{
                        backgroundColor: tone.bg,
                        color: tone.fg,
                        border: `1px solid ${tone.border}`,
                        fontWeight: 600,
                        fontFamily: FONT,
                      }}
                    >
                      {band ? bandLabel(band) : "Healthy"}
                    </span>
                    {(soDocs.length > 0 || prDocs.length > 0) && (
                      <span
                        className="inline-flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CombinedSourcePill soDocs={soDocs} prDocs={prDocs} uom={item.uom} />
                      </span>
                    )}
                  </div>

                  {/* KPI rows — label / value pairs (Partners pattern) */}
                  <div className="space-y-1.5 text-xs text-muted-foreground" style={{ fontFamily: FONT }}>
                    <div className="flex justify-between">
                      <span>Gap</span>
                      <span
                        className="tabular-nums"
                        style={{ fontWeight: 500, color: gap < 0 ? "#b91c1c" : "hsl(var(--foreground))" }}
                      >
                        {gap > 0 ? "+" : ""}
                        {gap} {item.uom}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current ATP</span>
                      <span className="text-foreground tabular-nums">
                        {proj ? `${proj.currentAtp.toLocaleString()} ${proj.baseUom}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Need by</span>
                      <span className="text-foreground">
                        {needDate ? (
                          <>
                            {fmtNeedBy(needDate)}{" "}
                            <span style={{ color: needHintColor, fontWeight: 500 }}>· {needHint}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Footer — owner + the row's primary CTA (mirrors the
                      table's Owner column + sticky Actions button) */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                    {own ? (
                      <div
                        className="flex items-center gap-2 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <UserHoverCard name={own.owner}>
                          <span className="shrink-0">
                            <AvatarCircle name={own.owner} size={24} />
                          </span>
                        </UserHoverCard>
                        <span
                          className="text-xs truncate"
                          style={{ fontFamily: FONT, color: "hsl(var(--muted-foreground))" }}
                          title={own.owner}
                        >
                          {own.owner}
                          {own.ownedByMe && " (You)"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground" style={{ fontFamily: FONT }}>
                        Unassigned
                      </span>
                    )}
                    {onPlanInSandbox && (() => {
                      const sb = sandboxActionFor(item.itemCode);
                      return (
                        <Button
                          size="sm"
                          variant={sb.secondary ? "outline" : "default"}
                          className={`h-7 text-[12px] cursor-pointer shrink-0 ${
                            sb.secondary
                              ? "bg-white border-primary text-primary hover:bg-accent hover:text-primary"
                              : "bg-[#0a77ff] hover:bg-[#0866dd]"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlanInSandbox(item.itemCode);
                          }}
                          title={sb.planning ? "You're planning this item — enter the sandbox" : sb.label}
                        >
                          {sb.label}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* Table min-width = pinned Item + resizable middle widths + pinned
     Actions. Grows as columns are resized so the table scrolls horizontally
     (Purchase Orders table behavior). */
  const tableMinW =
    (showSelect ? SELECT_COL_W : 0) +
    (isVisible("item") ? ITEM_COL_W : 0) +
    middleOrder.reduce((sum, id) => sum + (columnWidths[id] ?? MIDDLE_COL_META[id]?.minWidth ?? 120), 0) +
    ACTIONS_COL_W;
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <Table style={{ minWidth: tableMinW }}>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow className={`bg-[rgb(248,250,252)] hover:bg-[rgb(248,250,252)] ${thHeight}`}>
            {/* Selection — sticky-left checkbox column (Partners-directory
               pattern). Header is the page-level select-all with an
               indeterminate state when only some rows are picked. Hidden in
               the first-time flow (single-item planning). */}
            {showSelect && (
              <TableHead
                className={`${HEADER_TH_BASE} !pr-0`}
                style={{ ...HEADER_FONT, width: SELECT_COL_W, minWidth: SELECT_COL_W, ...stickyHeader(0, false) }}
              >
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => onToggleSelectMany?.(pageIds, v === true)}
                  aria-label="Select all rows"
                  className="translate-y-[1px]"
                />
              </TableHead>
            )}
            {/* Item — sticky-left identity column; pinned (no drag / resize),
               PO-style two-arrow sort. Frozen just after the checkbox (or at
               the table edge when the checkbox column is hidden). Uses the
               Partners popover menu with `isLocked` so Hide / Freeze don't
               show (Item is structurally always visible + always frozen). */}
            {isVisible("item") && (() => {
              const itemActive = sortBy === "item";
              return (
                <TableHead
                  className={`${HEADER_TH_BASE} min-w-[200px] group/colheader`}
                  style={{ ...HEADER_FONT, fontSize: 12, width: ITEM_COL_W, ...stickyHeader(showSelect ? SELECT_COL_W : 0, true) }}
                >
                  <ColumnHeaderMenu
                    columnKey="item"
                    label="Item"
                    sortable
                    isLocked
                    sortConfig={
                      (itemActive ? { key: "item", direction: sortDir } : null) as CMSortConfig | null
                    }
                    onSort={menuOnSort}
                    onHideColumn={() => {}}
                  >
                    <div className="flex items-center gap-1.5 select-none">
                      <span style={itemActive ? { color: "hsl(var(--primary))" } : undefined}>Item</span>
                      {itemActive
                        ? sortDir === "asc"
                          ? <ArrowUp className="size-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                          : <ArrowDown className="size-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                        : <ArrowUpDown className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-60 transition-opacity" />}
                    </div>
                  </ColumnHeaderMenu>
                </TableHead>
              );
            })()}
            {middleOrder.map((id) => (
              <React.Fragment key={id}>{renderMiddleHeader(id)}</React.Fragment>
            ))}
            <TableHead
              className={`${HEADER_TH_BASE} w-[150px] text-right !pl-2 !pr-3`}
              style={{ ...HEADER_FONT, fontSize: 12, width: ACTIONS_COL_W, ...stickyHeader("auto", true) }}
            >
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderedItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColCount} className="p-0">
                <EmptyState
                  icon={Package}
                  title="No demand gaps"
                  description="No items match your current search or filters. Adjust the filters above or check back later."
                />
              </TableCell>
            </TableRow>
          )}
          {orderedItems.map((item) => {
            const gap = gapFor(item);
            const isSelected = selectedItems.has(item.id);
            /* Selected rows get the Partners active-blue tint (#EBF3FF). The
               sticky Item/checkbox cells paint their own background over
               scrolling content, so they carry the same tint when selected. */
            const stickyBg: React.CSSProperties = {
              backgroundColor: isSelected ? "#EBF3FF" : "white",
            };
            return (
              <React.Fragment key={item.id}>
                <TableRow
                  // Row click opens the item's TRANSACTION LEDGER drawer (E2).
                  // The identity cell (name + thumbnail) and the Actions cell
                  // both stopPropagation, so: data cells → ledger, name/thumb
                  // → QuickView detail, Sandbox CTA → sandbox. Adding is still
                  // an explicit action only (never a bare row click).
                  onClick={() => onOpenTransactions?.(item.itemCode)}
                  className={`group cursor-pointer hover:bg-[#F0F7FF] transition-none ${isSelected ? "bg-[#EBF3FF]" : ""} ${rowPad} [&>td]:pl-4 [&>td]:pr-4`}
                >
                  {/* sticky-left: selection checkbox. stopPropagation so
                     ticking it never triggers the row's navigate-to-sandbox.
                     Hidden in the first-time flow (single-item planning). */}
                  {showSelect && (
                    <TableCell
                      className="sticky left-0 z-10 !pr-0 group-hover:!bg-[#F0F7FF]"
                      style={{ ...stickyBg, width: SELECT_COL_W, minWidth: SELECT_COL_W }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => onToggleSelect(item.id)}
                        aria-label={`Select ${item.itemCode}`}
                        className="translate-y-[1px]"
                      />
                    </TableCell>
                  )}
                  {/* sticky-left: Item — frozen identity column, just after
                     the checkbox (or at the table edge when it's hidden). */}
                  <TableCell
                    className="min-w-[200px] sticky z-10 group-hover:!bg-[#F0F7FF]"
                    style={{ ...stickyBg, left: showSelect ? SELECT_COL_W : 0, boxShadow: FROZEN_LEFT_SHADOW }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      {/* Thumbnail — opens the QuickViewPanel item modal, the
                          same pattern the catalogue / Parts section uses.
                          (The item code beside it still opens the planning
                          workspace.) */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenItemQuickView?.(item); }}
                        // 32×32 rounded-lg — Partners avatar spec, matching
                        // the Purchase Orders table's identity cells.
                        className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0 border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                        style={{ borderColor: "#E8ECF1", padding: 0 }}
                        aria-label={`View details for ${item.itemCode}`}
                        title="View item details"
                      >
                        <ImageWithFallback
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {/* Item code opens the item DETAIL (QuickView) — the
                         same panel the thumbnail opens. It no longer enters
                         the sandbox; adding is the explicit Sandbox CTA only.
                         ItemHoverCard wraps it for the hover preview. */}
                      <ItemHoverCard code={item.itemCode} imageUrl={item.itemImage}>
                        <button
                          type="button"
                          onClick={() => onOpenItemQuickView?.(item)}
                          className="text-sm truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                          style={{
                            fontWeight: 500,
                            color: "hsl(var(--foreground))",
                            fontFamily: FONT,
                            background: "transparent",
                            border: 0,
                            padding: 0,
                          }}
                          aria-label={`Open details for ${item.itemCode}`}
                        >
                          {highlightMatch(item.itemCode, searchQuery || "")}
                        </button>
                      </ItemHoverCard>
                      {/* "In plan" marker — this item is already open in the
                          current sandbox session, so the row reads at a glance
                          as part of what you're working on right now. */}
                      {sandboxActionFor(item.itemCode).planning && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                          title="This item is in your current sandbox"
                        >
                          <FlaskConical className="h-2.5 w-2.5" />
                          In plan
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {middleOrder.map((id) => {
                    /* Apply the (resizable) column width + dragged-column
                       tint to each middle cell without editing all 7 cases —
                       clone the rendered TableCell and merge its style. */
                    const cell = renderMiddleCell(id, item, gap);
                    if (!React.isValidElement(cell)) {
                      return <React.Fragment key={id}>{cell}</React.Fragment>;
                    }
                    const el = cell as React.ReactElement<{ style?: React.CSSProperties; className?: string }>;
                    const w = columnWidths[id] ?? MIDDLE_COL_META[id]?.minWidth;
                    const isFrozen = frozenMiddleColumns.has(id);
                    /* Frozen middle cells stick to the same left offset as their
                       header. Paint the sticky-bg (matches the row's Item cell)
                       so the frozen cell doesn't reveal scrolling content behind
                       it, and hoist z above adjacent non-frozen cells. */
                    const frozenStyle: React.CSSProperties = isFrozen
                      ? {
                          position: "sticky",
                          left: frozenMiddleOffsets[id],
                          zIndex: 5,
                          backgroundColor: stickyBg.backgroundColor,
                          ...(lastFrozenMiddleId === id
                            ? { boxShadow: FROZEN_LEFT_SHADOW }
                            : {}),
                        }
                      : {};
                    return React.cloneElement(el, {
                      key: id,
                      className: isFrozen
                        ? `${el.props.className ?? ""} group-hover:!bg-[#F0F7FF]`.trim()
                        : el.props.className,
                      style: {
                        ...(el.props.style || {}),
                        width: w,
                        ...frozenStyle,
                        ...(draggingColumnKey === id ? { backgroundColor: "rgba(10,119,255,0.035)" } : {}),
                      },
                    });
                  })}


                  {/* sticky-right: Actions — branches on the projection signal.
                     Per the Procurement Planner spec (Step 1, distress detection):
                     a row with a non-healthy ATP projection (Future stockout)
                     MUST flow through the Sandbox so MOQ / lead-time / validates-
                     green gates fire — direct PO creation is intentionally
                     disabled. Healthy rows (or rows with no planner data) keep
                     the existing single-vendor fast path. */}
                  {/* Action — single Plan CTA, always present. Every
                     PO creation now flows through the Sandbox so the
                     buyer always sees the projection chart + multi-
                     vendor split + gate checks before committing.
                     The previous "+ Create PO" branch (healthy rows
                     bypassing the Sandbox) is gone. The Plan button
                     renders for every row — the Sandbox modal handles
                     the empty / no-planner-data case internally. */}
                  <TableCell
                    className="w-[150px] min-w-[150px] max-w-[150px] sticky right-0 z-10 group-hover:!bg-[#F0F7FF] !pl-2 !pr-3"
                    style={{ ...stickyBg, boxShadow: FROZEN_RIGHT_SHADOW }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      {onPlanInSandbox && (() => {
                        const sb = sandboxActionFor(item.itemCode);
                        return (
                          <Button
                            size="sm"
                            variant={sb.secondary ? "outline" : "default"}
                            className={`h-7 text-[12px] cursor-pointer ${
                              sb.secondary
                                ? "bg-white border-primary text-primary hover:bg-accent hover:text-primary"
                                : "bg-[#0a77ff] hover:bg-[#0866dd]"
                            }`}
                            onClick={() => onPlanInSandbox(item.itemCode)}
                            title={sb.planning ? "You're planning this item — enter the sandbox" : sb.label}
                          >
                            {sb.label}
                          </Button>
                        );
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* Sales Orders tab — each SO is a collapsible row showing its line items with
   need/have/gap status. Other source kinds (requests/low-stock) have their own tabs. */
function BySourceView({
  sos,
  expandedSOs,
  onToggleSO,
  hiddenColumns,
  density = "comfort",
  allDemandItems,
  onCreatePO,
  onCreateDemandPOForSOLineItem,
}: {
  sos: SalesOrder[];
  expandedSOs: Set<string>;
  onToggleSO: (id: string) => void;
  /** Unused — kept for parity with the original signature so call sites don't break */
  requests?: PurchaseRequest[];
  lowStockItems?: DemandItem[];
  hiddenColumns?: Set<string>;
  density?: "condensed" | "comfort";
  /** Optional master list — used to resolve an item image by code so SO
      line items can render with the same image+description treatment as
      the All-Demand / Low-Stock / Purchase-Requests tables. */
  allDemandItems?: DemandItem[];
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
  /** Per-line-item CTA — opens OrderFlow with single SO context.
      No vendor pre-filled (SOs don't carry one) so the modal forces
      the buyer to pick one before submission. */
  onCreateDemandPOForSOLineItem?: (
    so: SalesOrder,
    li: SalesOrder["lineItems"][number],
  ) => void;
}) {
  const hidden = hiddenColumns || new Set<string>();
  const isVisible = (id: string) => !hidden.has(id);
  const rowVPad = density === "condensed" ? "py-1.5" : "py-2.5";
  /* itemCode → image lookup so SO line items can show the same 28×28
     image chip used in the All Demand / Low Stock tables. Falls back to
     an empty string when no master item is found (ImageWithFallback
     handles the empty src gracefully). */
  const imageByCode = useMemo(() => {
    const map = new Map<string, string>();
    (allDemandItems || []).forEach((i) => map.set(i.itemCode, i.itemImage));
    return map;
  }, [allDemandItems]);
  if (sos.length === 0) {
    return (
      <EmptyState
        icon={ExternalLink}
        title="No sales orders"
        description="No sales orders match your current search or filters."
      />
    );
  }
  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {sos.map((so) => {
          const isExpanded = expandedSOs.has(so.id);
          const gaps = so.lineItems.filter((li) => li.have < li.need).length;
          const dueDate = new Date(so.dueDate);
          const daysUntilDue = Math.ceil(
            (dueDate.getTime() - TODAY.getTime()) / 86400000,
          );
          return (
            <div key={so.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => onToggleSO(so.id)}
                className={`w-full px-4 ${rowVPad} flex items-center gap-2 hover:bg-[#F0F7FF] text-left cursor-pointer`}
              >
                <ChevronRight
                  className="w-4 h-4 text-muted-foreground transition-transform"
                  style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                />
                <span
                  className="text-primary"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: FONT,
                  }}
                >
                  {so.soNumber}
                </span>
                {isVisible("customer") && (
                  <span style={{ fontSize: 12, color: "#64748B", fontFamily: FONT }}>· {so.customer}</span>
                )}
                {isVisible("dueDate") && (
                  <span style={{ fontSize: 12, color: "#64748B", fontFamily: FONT }}>
                    · Due {so.dueDate}{" "}
                    <span style={{ color: daysUntilDue <= 3 ? "#DC2626" : daysUntilDue <= 10 ? "#EA580C" : "#94A3B8" }}>
                      ({daysUntilDue <= 0 ? "Overdue" : `in ${daysUntilDue}d`})
                    </span>
                  </span>
                )}
                {isVisible("itemCount") && (
                  <span style={{ fontSize: 12, color: "#64748B", fontFamily: FONT }}>· {so.lineItems.length} items</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Pill label={urgencyFromDate(so.dueDate)} />
                  <span
                    className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border tabular-nums"
                    style={{
                      fontWeight: 500,
                      fontFamily: FONT,
                      backgroundColor: gaps > 0 ? "#fef2f2" : "#f0fdf4",
                      color: gaps > 0 ? "#b91c1c" : "#15803d",
                      borderColor: gaps > 0 ? "#fecaca" : "#bbf7d0",
                    }}
                  >
                    {gaps} gap{gaps === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-1 bg-[#F8FBFF]">
                  <div className="rounded-md border border-border overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[rgb(248,250,252)] hover:bg-[rgb(248,250,252)] [&>th]:h-8">
                          <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Item</TableHead>
                          <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Description</TableHead>
                          <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Need</TableHead>
                          <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Available</TableHead>
                          <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Gap</TableHead>
                          <TableHead className={`${HEADER_TH_BASE} text-right w-32`} style={HEADER_FONT}>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {so.lineItems.map((li, i) => {
                          const fulfilled = li.have >= li.need;
                          const lookupImage = imageByCode.get(li.itemCode) || "";
                          return (
                            <TableRow
                              key={i}
                              className="text-sm group hover:bg-[#F0F7FF] [&>td]:py-2.5 [&>td]:pl-4 [&>td]:pr-2"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ItemHoverCard code={li.itemCode} imageUrl={lookupImage}>
                                    <div
                                      className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border cursor-pointer"
                                      style={{ borderColor: "#E8ECF1" }}
                                    >
                                      <ImageWithFallback
                                        src={lookupImage}
                                        alt={li.itemName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  </ItemHoverCard>
                                  <ItemHoverCard code={li.itemCode} imageUrl={lookupImage}>
                                    <span
                                      className="text-sm truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                                      style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                                    >
                                      {li.itemCode}
                                    </span>
                                  </ItemHoverCard>
                                </div>
                              </TableCell>
                              <TableCell
                                className="text-[13px]"
                                style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                              >
                                {li.itemName}
                              </TableCell>
                              <TableCell
                                className="text-right text-sm tabular-nums"
                                style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                              >
                                {li.need} {li.uom}
                              </TableCell>
                              <TableCell
                                className="text-right text-sm tabular-nums"
                                style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                              >
                                {li.have} {li.uom}
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const g = li.have - li.need;
                                  return (
                                    <span
                                      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border tabular-nums"
                                      style={{
                                        fontWeight: 500,
                                        fontFamily: FONT,
                                        backgroundColor: g < 0 ? "#fef2f2" : "#f0fdf4",
                                        color: g < 0 ? "#b91c1c" : "#15803d",
                                        borderColor: g < 0 ? "#fecaca" : "#bbf7d0",
                                      }}
                                    >
                                      {g > 0 ? "+" : ""}
                                      {g} {li.uom}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  className="h-7 text-[12px] gap-1 cursor-pointer"
                                  onClick={() => {
                                    if (onCreateDemandPOForSOLineItem) {
                                      onCreateDemandPOForSOLineItem(so, li);
                                    } else {
                                      onCreatePO({ searchTerm: li.itemCode });
                                    }
                                  }}
                                >
                                  <Plus className="size-3.5" /> Create PO
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PurchaseRequestsTable({
  requests,
  density,
  hiddenColumns,
  onCreatePO,
  onCreateDemandPOForRequest,
  onDenyRequest,
  onDeferRequest,
}: {
  requests: PurchaseRequest[];
  density: "condensed" | "comfort";
  hiddenColumns?: Set<string>;
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
  /** Per-row CTA — opens OrderFlow with a single Request as the source.
      The modal prompts for a vendor since requests carry none. */
  onCreateDemandPOForRequest?: (r: PurchaseRequest) => void;
  /** Pending-row secondary actions — prompts for a reason / a date and
      flips the request status accordingly. Only rendered on rows whose
      status is still "Pending". */
  onDenyRequest?: (r: PurchaseRequest, reason: string) => void;
  onDeferRequest?: (r: PurchaseRequest, until: string) => void;
}) {
  const rowPad = density === "condensed" ? "[&>td]:py-1" : "[&>td]:py-2";
  const thHeight = "[&>th]:h-8";
  const hidden = hiddenColumns || new Set<string>();
  /* Active dialog state — null means closed. We keep these at table-level
     rather than per-row so a single dialog instance is re-used; this also
     avoids losing input when the table re-renders. */
  const [denyTarget, setDenyTarget] = useState<PurchaseRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [deferTarget, setDeferTarget] = useState<PurchaseRequest | null>(null);
  const [deferUntil, setDeferUntil] = useState("");
  const isVisible = (id: string) => !hidden.has(id);
  const visibleColCount =
    (isVisible("requester") ? 1 : 0) +
    (isVisible("item") ? 1 : 0) +
    (isVisible("description") ? 1 : 0) +
    (isVisible("qty") ? 1 : 0) +
    (isVisible("reason") ? 1 : 0) +
    (isVisible("submitted") ? 1 : 0) +
    (isVisible("neededBy") ? 1 : 0) +
    (isVisible("urgency") ? 1 : 0) +
    (isVisible("status") ? 1 : 0) +
    (isVisible("actions") ? 1 : 0);

  return (
    <div className="min-h-0 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow className={`bg-[rgb(248,250,252)] hover:bg-[rgb(248,250,252)] ${thHeight}`}>
            <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Requester</TableHead>
            <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Item</TableHead>
            {isVisible("description") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Description</TableHead>
            )}
            {isVisible("qty") && (
              <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Qty</TableHead>
            )}
            {isVisible("reason") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Reason</TableHead>
            )}
            {isVisible("submitted") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Submitted</TableHead>
            )}
            {isVisible("neededBy") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Need by</TableHead>
            )}
            {isVisible("urgency") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Urgency</TableHead>
            )}
            {isVisible("status") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Status</TableHead>
            )}
            <TableHead
              className={`${HEADER_TH_BASE} text-right w-[180px]`}
              style={{ ...HEADER_FONT, position: "sticky", right: 0, zIndex: 30, backgroundColor: HEADER_BG, boxShadow: FROZEN_RIGHT_SHADOW }}
            >
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColCount} className="p-0">
                <EmptyState
                  icon={Inbox}
                  title="No requests"
                  description="No purchase requests match your current search or status filter."
                />
              </TableCell>
            </TableRow>
          )}
          {requests.map((r) => (
            <TableRow
              key={r.id}
              className={`text-sm group hover:bg-[#F0F7FF] ${rowPad} [&>td]:pl-4 [&>td]:pr-2`}
            >
              <TableCell>
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserHoverCard name={r.requesterName}>
                    <div className="cursor-pointer">
                      <LetterAvatar
                        letter={r.requesterName.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase()}
                        name={r.requesterName}
                        shape="full"
                      />
                    </div>
                  </UserHoverCard>
                  <UserHoverCard name={r.requesterName}>
                    <div className="min-w-0 cursor-pointer group/poc">
                      <span
                        className="text-sm block truncate group-hover/poc:text-primary group-hover/poc:underline transition-colors"
                        style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                      >
                        {r.requesterName}
                      </span>
                    </div>
                  </UserHoverCard>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  <ItemHoverCard code={r.itemCode} imageUrl={r.itemImage}>
                    <div
                      className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border cursor-pointer"
                      style={{ borderColor: "#E8ECF1" }}
                    >
                      <ImageWithFallback
                        src={r.itemImage}
                        alt={r.itemName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </ItemHoverCard>
                  <ItemHoverCard code={r.itemCode} imageUrl={r.itemImage}>
                    <span
                      className="text-sm truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                      style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                    >
                      {r.itemCode}
                    </span>
                  </ItemHoverCard>
                </div>
              </TableCell>
              {isVisible("description") && (
                <TableCell
                  className="text-sm max-w-[260px] truncate"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  {r.itemName}
                </TableCell>
              )}
              {isVisible("qty") && (
                <TableCell
                  className="text-right text-sm tabular-nums"
                  style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                >
                  {r.quantity} {r.uom}
                </TableCell>
              )}
              {isVisible("reason") && (
                <TableCell
                  className="text-[13px] italic max-w-[280px] truncate"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  "{r.reason}"
                </TableCell>
              )}
              {isVisible("submitted") && (
                <TableCell
                  className="text-[13px] whitespace-nowrap"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  {r.submittedDate}
                </TableCell>
              )}
              {isVisible("neededBy") && (
                <TableCell
                  className="text-[13px] whitespace-nowrap"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  {r.neededBy || "—"}
                </TableCell>
              )}
              {isVisible("urgency") && (
                <TableCell>
                  <Pill label={urgencyForRequest(r)} />
                </TableCell>
              )}
              {isVisible("status") && (
                <TableCell>
                  <Pill label={r.status} />
                  {r.status === "Denied" && r.denyReason && (
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                    >
                      {r.denyReason}
                    </p>
                  )}
                  {r.status === "Deferred" && r.deferUntil && (
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                    >
                      Review {r.deferUntil}
                    </p>
                  )}
                </TableCell>
              )}
              <TableCell
                className="text-right sticky right-0 z-10 bg-white group-hover:!bg-[#F0F7FF]"
                style={{ boxShadow: FROZEN_RIGHT_SHADOW }}
              >
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-[12px] gap-1 cursor-pointer"
                    onClick={() => {
                      if (onCreateDemandPOForRequest) {
                        onCreateDemandPOForRequest(r);
                      } else {
                        onCreatePO({ searchTerm: r.itemCode });
                      }
                    }}
                  >
                    <Plus className="size-3.5" /> Create PO
                  </Button>
                  {/* Kebab is always rendered for visual consistency across
                     rows. Defer / Decline are only meaningful while the row
                     is still Pending, so the trigger is disabled on rows
                     that have already been approved / denied / deferred. */}
                  {(() => {
                    const canAct =
                      r.status === "Pending" && (onDeferRequest || onDenyRequest);
                    if (!canAct) {
                      return (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] border border-transparent opacity-40 cursor-not-allowed"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                          aria-label="No actions available"
                          title="No further actions for this status"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      );
                    }
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer border border-transparent hover:border-border hover:bg-secondary data-[state=open]:bg-secondary data-[state=open]:border-border"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          {onDeferRequest && (
                            <DropdownMenuItem
                              onClick={() => {
                                setDeferUntil(r.neededBy || "");
                                setDeferTarget(r);
                              }}
                            >
                              <Clock className="w-3.5 h-3.5 mr-2" /> Defer
                            </DropdownMenuItem>
                          )}
                          {onDenyRequest && (
                            <DropdownMenuItem
                              onClick={() => {
                                setDenyReason("");
                                setDenyTarget(r);
                              }}
                              style={{ color: "#B91C1C" }}
                            >
                              <Ban className="w-3.5 h-3.5 mr-2" /> Decline
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* ── Decline dialog ──
         Triggered from the kebab menu on a Pending row. Buyer types a
         short reason; on submit we call back into the parent which
         flips the row's status to "Denied" and notes the reason. */}
      <Dialog
        open={!!denyTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDenyTarget(null);
            setDenyReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Decline request</DialogTitle>
            <DialogDescription>
              {denyTarget && (
                <>
                  Declining <strong>{denyTarget.itemCode}</strong> from{" "}
                  <strong>{denyTarget.requesterName}</strong>. The requester will be
                  notified with the reason below.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="deny-reason" className="text-[12px]">
              Reason
            </Label>
            <Textarea
              id="deny-reason"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="e.g. Budget constraints this quarter — please resubmit next quarter."
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDenyTarget(null);
                setDenyReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!denyReason.trim()}
              onClick={() => {
                if (denyTarget && denyReason.trim() && onDenyRequest) {
                  onDenyRequest(denyTarget, denyReason.trim());
                }
                setDenyTarget(null);
                setDenyReason("");
              }}
              style={{ backgroundColor: "#DC2626", color: "white" }}
              className="hover:opacity-90"
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" /> Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Defer dialog ──
         Same trigger; here the buyer picks a future date when the
         request should resurface for re-review. */}
      <Dialog
        open={!!deferTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeferTarget(null);
            setDeferUntil("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Defer request</DialogTitle>
            <DialogDescription>
              {deferTarget && (
                <>
                  Deferring <strong>{deferTarget.itemCode}</strong> from{" "}
                  <strong>{deferTarget.requesterName}</strong>. The request will
                  resurface in your queue on the date you pick.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="defer-until" className="text-[12px]">
              Resurface on
            </Label>
            <SystemDatePicker
              value={deferUntil}
              onChange={setDeferUntil}
              min={new Date()}
              placeholder="Pick a resurface date"
            />
            <p
              className="text-[11px]"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
            >
              The requester will receive a notification when the request comes back
              up for review.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeferTarget(null);
                setDeferUntil("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!deferUntil}
              onClick={() => {
                if (deferTarget && deferUntil && onDeferRequest) {
                  onDeferRequest(deferTarget, deferUntil);
                }
                setDeferTarget(null);
                setDeferUntil("");
              }}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Defer request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LowStockTable({
  items,
  density,
  hiddenColumns,
  onCreatePO,
  onCreateDemandPOForLowStockItem,
}: {
  items: DemandItem[];
  density: "condensed" | "comfort";
  hiddenColumns?: Set<string>;
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
  /** Per-row CTA — opens OrderFlow with a single Low-Stock source.
      Vendor is pre-filled from item.preferredVendor. */
  onCreateDemandPOForLowStockItem?: (item: DemandItem) => void;
}) {
  const rowPad = density === "condensed" ? "[&>td]:py-1" : "[&>td]:py-2";
  const thHeight = "[&>th]:h-8";
  const hidden = hiddenColumns || new Set<string>();
  const isVisible = (id: string) => !hidden.has(id);
  const visibleColCount =
    (isVisible("item") ? 1 : 0) +
    (isVisible("description") ? 1 : 0) +
    (isVisible("currentStock") ? 1 : 0) +
    (isVisible("reorderPoint") ? 1 : 0) +
    (isVisible("gap") ? 1 : 0) +
    (isVisible("vendor") ? 1 : 0) +
    (isVisible("actions") ? 1 : 0);
  return (
    <div className="min-h-0 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow className={`bg-[rgb(248,250,252)] hover:bg-[rgb(248,250,252)] ${thHeight}`}>
            <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Item</TableHead>
            {isVisible("description") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Description</TableHead>
            )}
            {isVisible("currentStock") && (
              <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Current Stock</TableHead>
            )}
            {isVisible("reorderPoint") && (
              <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Minimum Order Quantity</TableHead>
            )}
            {isVisible("gap") && (
              <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Gap</TableHead>
            )}
            {isVisible("vendor") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Preferred Vendor</TableHead>
            )}
            <TableHead
              className={`${HEADER_TH_BASE} text-right w-[140px]`}
              style={{ ...HEADER_FONT, position: "sticky", right: 0, zIndex: 30, backgroundColor: HEADER_BG, boxShadow: FROZEN_RIGHT_SHADOW }}
            >
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColCount} className="p-0">
                <EmptyState
                  icon={AlertTriangle}
                  title="No low-stock items"
                  description="All items are above their minimum order quantity — no replenishment needed right now."
                />
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => {
            const gap = item.currentStock - (item.reorderPoint ?? 0);
            return (
              <TableRow
                key={item.id}
                className={`text-sm group hover:bg-[#F0F7FF] ${rowPad} [&>td]:pl-4 [&>td]:pr-2`}
              >
                <TableCell>
                  <div className="flex items-center gap-2 min-w-0">
                    <ItemHoverCard code={item.itemCode} imageUrl={item.itemImage}>
                      <div
                        className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border cursor-pointer"
                        style={{ borderColor: "#E8ECF1" }}
                      >
                        <ImageWithFallback
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </ItemHoverCard>
                    <ItemHoverCard code={item.itemCode} imageUrl={item.itemImage}>
                      <span
                        className="text-sm truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                        style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                      >
                        {item.itemCode}
                      </span>
                    </ItemHoverCard>
                  </div>
                </TableCell>
                {isVisible("description") && (
                  <TableCell
                    className="text-sm max-w-[260px] truncate"
                    style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                  >
                    {item.itemName}
                  </TableCell>
                )}
                {isVisible("currentStock") && (
                  <TableCell
                    className="text-right text-sm tabular-nums"
                    style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                  >
                    {item.currentStock} {item.uom}
                  </TableCell>
                )}
                {isVisible("reorderPoint") && (
                  <TableCell
                    className="text-right text-sm tabular-nums"
                    style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                  >
                    {item.reorderPoint} {item.uom}
                  </TableCell>
                )}
                {isVisible("gap") && (
                  <TableCell className="text-right">
                    <span
                      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border tabular-nums"
                      style={{
                        fontWeight: 500,
                        fontFamily: FONT,
                        backgroundColor: gap < 0 ? "#fef2f2" : "#f0fdf4",
                        color: gap < 0 ? "#b91c1c" : "#15803d",
                        borderColor: gap < 0 ? "#fecaca" : "#bbf7d0",
                      }}
                    >
                      {gap > 0 ? "+" : ""}
                      {gap} {item.uom}
                    </span>
                  </TableCell>
                )}
                {isVisible("vendor") && (
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <LetterAvatar
                        letter={item.vendorAbbr}
                        name={item.preferredVendor}
                        shape="lg"
                      />
                      <span
                        className="text-sm truncate"
                        style={{ fontWeight: 500, color: "rgb(30, 41, 59)", fontFamily: FONT }}
                      >
                        {item.preferredVendor.split(" (")[0]}
                      </span>
                    </div>
                  </TableCell>
                )}
                <TableCell
                  className="text-right sticky right-0 z-10 bg-white group-hover:!bg-[#F0F7FF]"
                  style={{ boxShadow: FROZEN_RIGHT_SHADOW }}
                >
                  <Button
                    size="sm"
                    className="h-7 text-[12px] gap-1 cursor-pointer"
                    onClick={() => {
                      if (onCreateDemandPOForLowStockItem) {
                        onCreateDemandPOForLowStockItem(item);
                      } else {
                        onCreatePO({ searchTerm: item.itemCode, vendor: item.preferredVendor });
                      }
                    }}
                  >
                    <Plus className="size-3.5" /> Create PO
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* Stale POs table — column set mirrors the Purchase Orders table 1:1, with
   one extra column (Days Stale). Optional fields render "—" when missing so
   a partially populated stale PO still displays cleanly.

   The action button skips the OrderFlow modal entirely: a stale PO is already
   a Draft, so clicking + Create PO navigates straight to its detail page. */
function StalePOsTable({
  stalePOs,
  density,
  hiddenColumns,
  onNavigatePO,
}: {
  stalePOs: PODemandsProps["stalePOs"];
  density: "condensed" | "comfort";
  hiddenColumns?: Set<string>;
  onNavigatePO: (id: string) => void;
  /** Kept for prop-shape parity with the other tables; unused here. */
  onCreatePO?: (opts?: { searchTerm?: string; vendor?: string }) => void;
}) {
  const rowPad = density === "condensed" ? "[&>td]:py-1" : "[&>td]:py-2";
  const thHeight = "[&>th]:h-8";
  const hidden = hiddenColumns || new Set<string>();
  const isVisible = (id: string) => !hidden.has(id);
  const visibleColCount =
    1 /* PO No */ +
    (isVisible("vendor") ? 1 : 0) +
    (isVisible("status") ? 1 : 0) +
    (isVisible("orderedItems") ? 1 : 0) +
    (isVisible("pointOfContact") ? 1 : 0) +
    (isVisible("location") ? 1 : 0) +
    (isVisible("createdBy") ? 1 : 0) +
    (isVisible("dueDeliveryDate") ? 1 : 0) +
    (isVisible("orderDate") ? 1 : 0) +
    (isVisible("daysStale") ? 1 : 0) +
    1 /* Action */;

  return (
    <div className="min-h-0 overflow-auto">
      <Table style={{ minWidth: 1500 }}>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow className={`bg-[rgb(248,250,252)] hover:bg-[rgb(248,250,252)] ${thHeight}`}>
            <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>PO No</TableHead>
            {isVisible("vendor") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Partner Location</TableHead>
            )}
            {isVisible("status") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Status</TableHead>
            )}
            {isVisible("orderedItems") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Ordered Item(s)</TableHead>
            )}
            {isVisible("pointOfContact") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Point of Contact</TableHead>
            )}
            {isVisible("location") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Location</TableHead>
            )}
            {isVisible("createdBy") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Created By</TableHead>
            )}
            {isVisible("dueDeliveryDate") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Due Delivery Date</TableHead>
            )}
            {isVisible("orderDate") && (
              <TableHead className={HEADER_TH_BASE} style={HEADER_FONT}>Order Date</TableHead>
            )}
            {isVisible("daysStale") && (
              <TableHead className={`${HEADER_TH_BASE} text-right`} style={HEADER_FONT}>Days Stale</TableHead>
            )}
            <TableHead
              className={`${HEADER_TH_BASE} text-right w-[140px]`}
              style={{ ...HEADER_FONT, position: "sticky", right: 0, zIndex: 30, backgroundColor: HEADER_BG, boxShadow: FROZEN_RIGHT_SHADOW }}
            >
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stalePOs.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColCount} className="p-0">
                <EmptyState
                  icon={FileWarning}
                  title="No stale POs"
                  description="No drafts have been sitting for more than 7 days — your pipeline is healthy."
                />
              </TableCell>
            </TableRow>
          )}
          {stalePOs.map((po) => {
            const vendorAbbr =
              po.vendorAbbr ||
              po.vendor
                .split(" ")
                .map((w) => w[0] || "")
                .join("")
                .slice(0, 2)
                .toUpperCase();
            const pocInitials = po.pointOfContactAbbr ||
              (po.pointOfContact
                ? po.pointOfContact.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase()
                : "");
            const cb = po.createdBy || "";
            const cbInitials = cb
              ? cb.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase()
              : "";
            const orderedItems = po.orderedItems || [];
            const firstItem = orderedItems[0];
            const extraCount = Math.max(0, orderedItems.length - 1);
            return (
              <TableRow
                key={po.id}
                className={`text-sm group hover:bg-[#F0F7FF] ${rowPad} [&>td]:pl-4 [&>td]:pr-2`}
              >
                {/* PO No — link to draft */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onNavigatePO(po.id)}
                    className="text-sm group/po cursor-pointer bg-transparent border-0 p-0 flex items-center gap-1.5"
                    style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--foreground))" }}
                  >
                    <span className="group-hover/po:text-primary group-hover/po:underline transition-colors tabular-nums">
                      {po.poNumber}
                    </span>
                    {po.version && (
                      <span
                        className="inline-flex items-center px-1.5 py-px rounded text-[10px] tabular-nums"
                        style={{
                          backgroundColor: "hsl(var(--secondary))",
                          color: "hsl(var(--muted-foreground))",
                          fontFamily: FONT,
                          fontWeight: 500,
                        }}
                      >
                        V{po.version}
                      </span>
                    )}
                  </button>
                </TableCell>

                {/* Partner Location — company avatar + name */}
                {isVisible("vendor") && (
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <LetterAvatar letter={vendorAbbr} name={po.vendor} shape="lg" />
                      <span
                        className="text-sm truncate"
                        style={{ fontWeight: 500, color: "rgb(30, 41, 59)", fontFamily: FONT }}
                      >
                        {po.vendor}
                      </span>
                    </div>
                  </TableCell>
                )}

                {/* Status — same badge style as the PO table */}
                {isVisible("status") && (
                  <TableCell>
                    <span
                      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border"
                      style={{
                        fontWeight: 500,
                        fontFamily: FONT,
                        ...getStatusBadgeCss(po.status),
                      }}
                    >
                      {po.status}
                    </span>
                  </TableCell>
                )}

                {/* Ordered Items — first item image + code, "+N more" hint */}
                {isVisible("orderedItems") && (
                  <TableCell>
                    {firstItem ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border"
                          style={{ borderColor: "#E8ECF1" }}
                        >
                          <ImageWithFallback
                            src={firstItem.image}
                            alt={firstItem.code}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span
                          className="text-sm truncate"
                          style={{ fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT }}
                        >
                          {firstItem.code}
                        </span>
                        {extraCount > 0 && (
                          <span
                            className="text-[11px] shrink-0 whitespace-nowrap"
                            style={{ fontWeight: 600, color: "hsl(var(--primary))", fontFamily: FONT }}
                          >
                            +{extraCount} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>—</span>
                    )}
                  </TableCell>
                )}

                {/* Point of Contact — avatar + name (or — if missing) */}
                {isVisible("pointOfContact") && (
                  <TableCell>
                    {po.pointOfContact ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <LetterAvatar letter={pocInitials} name={po.pointOfContact} shape="full" />
                        <span
                          className="text-sm truncate"
                          style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}
                        >
                          {po.pointOfContact}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>—</span>
                    )}
                  </TableCell>
                )}

                {/* Location */}
                {isVisible("location") && (
                  <TableCell>
                    <span
                      className="text-sm truncate block"
                      style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                      title={po.locationAddress || po.location || ""}
                    >
                      {po.locationAddress || po.location || "—"}
                    </span>
                  </TableCell>
                )}

                {/* Created By */}
                {isVisible("createdBy") && (
                  <TableCell>
                    {cb ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <LetterAvatar letter={cbInitials} name={cb} shape="full" />
                        <span
                          className="text-sm truncate"
                          style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}
                        >
                          {cb}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>—</span>
                    )}
                  </TableCell>
                )}

                {/* Due Delivery Date */}
                {isVisible("dueDeliveryDate") && (
                  <TableCell
                    className="text-[13px] whitespace-nowrap"
                    style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                  >
                    {po.dueDeliveryDate || "—"}
                  </TableCell>
                )}

                {/* Order Date */}
                {isVisible("orderDate") && (
                  <TableCell
                    className="text-[13px] whitespace-nowrap"
                    style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                  >
                    {po.orderDate}
                  </TableCell>
                )}

                {/* Days Stale — the only column not present on the PO table */}
                {isVisible("daysStale") && (
                  <TableCell className="text-right">
                    <span
                      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs rounded-md border tabular-nums"
                      style={{
                        fontWeight: 500,
                        fontFamily: FONT,
                        backgroundColor: po.daysStale > 14 ? "#fef2f2" : "#fff7ed",
                        color: po.daysStale > 14 ? "#b91c1c" : "#c2410c",
                        borderColor: po.daysStale > 14 ? "#fecaca" : "#fed7aa",
                      }}
                    >
                      {po.daysStale}d
                    </span>
                  </TableCell>
                )}

                {/* Action — skip OrderFlow modal; jump straight to the Draft PO. */}
                <TableCell
                  className="text-right sticky right-0 z-10 bg-white group-hover:!bg-[#F0F7FF]"
                  style={{ boxShadow: FROZEN_RIGHT_SHADOW }}
                >
                  <Button
                    size="sm"
                    className="h-7 text-[12px] gap-1 cursor-pointer"
                    onClick={() => onNavigatePO(po.id)}
                  >
                    <Plus className="size-3.5" /> Create PO
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Windowed page-number list with `…` ellipses when total > 7. */
function getPageNumbers(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  if (currentPage > 3) pages.push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

/** Pagination footer — matches the partner-listing (ContactsDirectoryPage)
 *  design: shadcn Select + ghost Buttons, `«  ‹ Prev  [1]  Next ›  »`
 *  row. Applied consistently across every planner listing table. */
function PaginationFooter({
  page,
  pageCount,
  onChange,
  pageSize,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}) {
  const pages = getPageNumbers(page, pageCount);
  return (
    <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3">
      {pageSize !== undefined && onPageSizeChange && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Records per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              onPageSizeChange(parseInt(val, 10));
              onChange(1);
            }}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Buyer 2026-07-16: 20 / 50 / 100 / All. "All" uses
                  the -1 sentinel; the slice math promotes it to a
                  safe upper bound so a single "page" carries every
                  row. Always visible regardless of dataset size. */}
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="-1">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page === 1}
          onClick={() => onChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-sm text-muted-foreground"
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </Button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="px-1 text-sm text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={page === p ? "default" : "ghost"}
              size="sm"
              className={`h-8 w-8 p-0 text-sm ${
                page === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => onChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-sm text-muted-foreground"
          disabled={page === pageCount}
          onClick={() => onChange(Math.min(pageCount, page + 1))}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page === pageCount}
          onClick={() => onChange(pageCount)}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
