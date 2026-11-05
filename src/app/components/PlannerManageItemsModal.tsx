/* ═══════════════════════════════════════════════════════════════
   PLANNER — MANAGE ITEMS MODAL
   ───────────────────────────────────────────────────────────────
   A faithful port of the Partners "Manage Items" modal — the
   AddItemModal defined in Partners/.../vendors/PartnerItemsTab.tsx
   and surfaced (in `generic` mode) from the Pricing-Rules flow.

   The render is reproduced as-is: same header, Browse-Inventory /
   Added-Items toggle, sort pills, sticky-column inventory table with
   the 32px thumbnail + hover-card + quick-view, pagination, footer
   CTAs, and the gradient bulk-remove confirmation. The ONLY changes
   are integration plumbing, not design:

     • data source — rows come from the planner's own demand items
       (mapped into the modal's PartnerItemData shape) instead of the
       Partners INVENTORY_ITEMS catalogue;
     • dialog shell — rendered through Radix primitives so it layers
       above the scope filter modal (z-[225]/z-[230]); the modal draws
       its own close button, so the default one isn't needed;
     • the pricing-rule-specific "Discount · N" header badge is
       dropped (no such concept in the planner).

   Selection is keyed by item CODE, which is what the planner's scope
   params (params.items) filter on — so adding here narrows the table.
   ═══════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./ui/hover-card";
import {
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Package,
  Maximize2,
  Minimize2,
  Trash2,
  Mail,
  Building2,
  Phone,
  ExternalLink,
} from "lucide-react";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import { toast } from "sonner";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type ItemTeamMember = {
  name: string;
  initials: string;
  bgColor: string;
  photoUrl: string;
  role: string;
  dept: string;
  email: string;
  phone: string;
  contactId: string;
};

export interface PartnerItemData {
  id: string;
  partNo: string;
  description: string;
  manufacturer: string;
  category: string;
  itemControlType: "Serialized" | "Non-Serialized";
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock";
  onHand: number;
  onHandUnit: string;
  acquisitionMethods: ("Purchased" | "Manufactured" | "Purchase")[];
  preferredAcquisition: "Purchased" | "Manufactured" | "Purchase";
  createdOn: string;
  createdBy: ItemTeamMember;
  owner: ItemTeamMember;
  status: "Active" | "Inactive";
  image: string;
  ownedByMe: boolean;
}

/** The planner item shape fed into the modal (real demand-item data). */
export interface PlannerInventoryItem {
  code: string;
  name: string;
  category: string;
  ownedByMe: boolean;
  image: string;
  onHand?: number;
  unit?: string;
  vendor?: string;
}

// ──────────────────────────────────────────────
// Constants (carried over from the Partners modal)
// ──────────────────────────────────────────────

const STOCK_STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "In Stock": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Low Stock": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  "Out of Stock": { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};

const ACQ_BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Purchased": { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  "Manufactured": { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
  "Purchase": { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Active": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Inactive": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

// Sample team-member roster used for the Created By / Owner avatars —
// same set as the Partners modal so the contact business-cards read
// identically.
const ITEM_TEAM_MEMBERS: ItemTeamMember[] = [
  { name: "Ahtisham Ahmad",  initials: "AA", bgColor: "#6366f1", photoUrl: "https://randomuser.me/api/portraits/men/36.jpg", role: "Procurement Lead",   dept: "Procurement",  email: "ahtisham.ahmad@company.com",  phone: "(412) 555-0142", contactId: "ahtisham-ahmad" },
  { name: "Faizan Khan",     initials: "FK", bgColor: "#10b981", photoUrl: "https://randomuser.me/api/portraits/men/29.jpg", role: "Supply Chain Manager", dept: "Supply Chain", email: "faizan.khan@company.com",     phone: "(412) 555-0167", contactId: "faizan-khan" },
  { name: "Areeb Tanveer",   initials: "AT", bgColor: "#0ea5e9", photoUrl: "https://randomuser.me/api/portraits/men/41.jpg", role: "Inventory Specialist", dept: "Operations",   email: "areeb.tanveer@company.com",   phone: "(412) 555-0188", contactId: "areeb-tanveer" },
  { name: "Eli Rosenbloom",  initials: "ER", bgColor: "#8b5cf6", photoUrl: "https://randomuser.me/api/portraits/men/55.jpg", role: "Operations Director",  dept: "Operations",   email: "eli.rosenbloom@company.com",  phone: "(412) 555-0199", contactId: "eli-rosenbloom" },
  { name: "Nophil Anwer",    initials: "NA", bgColor: "#f59e0b", photoUrl: "https://randomuser.me/api/portraits/men/67.jpg", role: "Logistics Coordinator", dept: "Logistics",   email: "nophil.anwer@company.com",    phone: "(412) 555-0211", contactId: "nophil-anwer" },
  { name: "Irtaza Abid",     initials: "IA", bgColor: "#ef4444", photoUrl: "https://randomuser.me/api/portraits/men/22.jpg", role: "Finance Supervisor",   dept: "Finance",      email: "irtaza.abid@company.com",     phone: "(412) 555-0234", contactId: "irtaza-abid" },
];

// Seeded RNG so synthesised metadata columns stay stable per item.
function seededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483647;
  return h + 7;
}

/* Map the planner's demand items into the modal's PartnerItemData
   rows. Real fields (code, name, category, on-hand, unit, vendor,
   image, ownership) flow straight through; the remaining table
   columns (control type, acquisition, created on/by, owner) are
   synthesised deterministically per item code — the same way the
   Partners catalogue fabricates them, so the table never looks
   half-empty. */
function mapToInventory(items: PlannerInventoryItem[]): PartnerItemData[] {
  const acqOptions: ("Purchased" | "Manufactured" | "Purchase")[][] = [
    ["Purchased"], ["Manufactured"], ["Purchased", "Manufactured"], ["Purchase"], ["Purchased"],
  ];
  return items.map((it) => {
    const r = seededRng(hashString(it.code));
    const onHand = typeof it.onHand === "number" ? it.onHand : Math.floor(r() * 15000);
    const stockStatus: PartnerItemData["stockStatus"] =
      onHand <= 0 ? "Out of Stock" : onHand < 50 ? "Low Stock" : "In Stock";
    const acquisitionMethods = acqOptions[Math.floor(r() * acqOptions.length)];
    return {
      id: it.code,
      partNo: it.code,
      description: it.name || it.code,
      manufacturer: it.vendor || "—",
      category: it.category || "—",
      itemControlType: r() > 0.75 ? "Serialized" : "Non-Serialized",
      stockStatus,
      onHand,
      onHandUnit: it.unit || "ea",
      acquisitionMethods,
      preferredAcquisition: acquisitionMethods[0],
      createdOn: new Date(2024, Math.floor(r() * 12), Math.floor(r() * 28) + 1).toISOString(),
      createdBy: ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)],
      owner: ITEM_TEAM_MEMBERS[Math.floor(r() * ITEM_TEAM_MEMBERS.length)],
      status: "Active",
      image: it.image,
      ownedByMe: it.ownedByMe,
    };
  });
}

// ──────────────────────────────────────────────
// Cell sub-components (verbatim from the Partners modal)
// ──────────────────────────────────────────────

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

/**
 * PersonCell — used by Created By + Owner columns. Photo avatar +
 * hover business-card popover, exactly as the Partners modal.
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
          <span className={`${isComfort ? "text-[13.5px]" : "text-sm"} text-slate-700 truncate group-hover/person:text-primary group-hover/person:underline transition-colors`}>
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
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{person.dept}</span></div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{person.phone}</span></div>
          <button
            type="button"
            onClick={handleNavigate}
            className="mt-2 inline-flex items-center justify-center w-full gap-1.5 h-8 rounded-md bg-primary text-white text-[12px] hover:bg-[#0862D0] transition-colors cursor-pointer"
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
// Manage Items Modal
// ──────────────────────────────────────────────

type ModalView = "browse" | "added";

export function PlannerManageItemsModal({
  open,
  onOpenChange,
  items,
  selectedCodes,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Full item universe shown in the modal (real planner demand items). */
  items: PlannerInventoryItem[];
  /** Currently selected item codes (= planner scope params.items). */
  selectedCodes: string[];
  /** Commit a new selection (array of item codes). */
  onChange: (codes: string[]) => void;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addedSelectedIds, setAddedSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ModalView>("browse");
  const [addedSearch, setAddedSearch] = useState("");
  const [addedPage, setAddedPage] = useState(1);
  const perPage = 15;
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  // The full row set + the existing/added split, both derived from the
  // planner data and the current selection.
  const inventory = useMemo(() => mapToInventory(items), [items]);
  const existingItemIds = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const existingItems = useMemo(
    () => inventory.filter((it) => existingItemIds.has(it.id)),
    [inventory, existingItemIds],
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
      setAddedSelectedIds(new Set());
      setPage(1);
      setView("browse");
      setAddedSearch("");
      setAddedPage(1);
    }
  }, [open]);

  const available = useMemo(() => {
    return inventory.filter((it) => !existingItemIds.has(it.id));
  }, [inventory, existingItemIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (it) =>
        it.partNo.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.manufacturer.toLowerCase().includes(q)
    );
  }, [available, search]);

  // Already added items — filtered by the added-view search.
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

  function commitCodes(next: string[]) {
    // De-dupe while preserving order.
    onChange(Array.from(new Set(next)));
  }

  function handleAdd() {
    const added = inventory.filter((it) => selectedIds.has(it.id)).map((it) => it.id);
    commitCodes([...selectedCodes, ...added]);
    onOpenChange(false);
    toast.success(`${added.length} item${added.length !== 1 ? "s" : ""} added`);
  }

  function handleItemRemoved(id: string) {
    commitCodes(selectedCodes.filter((c) => c !== id));
  }

  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);

  function handleBulkRemove() {
    const count = addedSelectedIds.size;
    commitCodes(selectedCodes.filter((c) => !addedSelectedIds.has(c)));
    toast.success(`${count} item${count !== 1 ? "s" : ""} removed`);
    setAddedSelectedIds(new Set());
    setBulkRemoveConfirmOpen(false);
  }

  // Counts for sort pills
  const browseSortCounts = useMemo(() => {
    const src = filtered;
    return {
      all: src.length,
      in_stock: src.filter((it) => it.stockStatus === "In Stock").length,
      low_stock: src.filter((it) => it.stockStatus === "Low Stock").length,
      serialized: src.filter((it) => it.itemControlType === "Serialized").length,
      non_serialized: src.filter((it) => it.itemControlType === "Non-Serialized").length,
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
    };
  }, [addedFiltered]);

  const [modalSort, setModalSort] = useState<string>("all");

  const MODAL_SORT_OPTIONS = view === "browse"
    ? [
        { key: "all", label: "All", count: browseSortCounts.all },
        { key: "in_stock", label: "In Stock", count: browseSortCounts.in_stock },
        { key: "low_stock", label: "Low Stock", count: browseSortCounts.low_stock },
        { key: "serialized", label: "Serialized", count: browseSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: browseSortCounts.non_serialized },
      ]
    : [
        { key: "all", label: "All", count: addedSortCounts.all },
        { key: "active", label: "Active", count: addedSortCounts.active },
        { key: "inactive", label: "Inactive", count: addedSortCounts.inactive },
        { key: "serialized", label: "Serialized", count: addedSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: addedSortCounts.non_serialized },
      ];

  useEffect(() => { setModalSort("all"); }, [view]);

  const sortedBrowse = useMemo(() => {
    let list = filtered;
    if (modalSort === "in_stock") list = list.filter((it) => it.stockStatus === "In Stock");
    else if (modalSort === "low_stock") list = list.filter((it) => it.stockStatus === "Low Stock");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    return list;
  }, [filtered, modalSort]);

  const sortedAdded = useMemo(() => {
    let list = addedFiltered;
    if (modalSort === "active") list = list.filter((it) => it.status === "Active");
    else if (modalSort === "inactive") list = list.filter((it) => it.status === "Inactive");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    return list;
  }, [addedFiltered, modalSort]);

  const browseTotalPages = Math.max(1, Math.ceil(sortedBrowse.length / perPage));
  const browsePaginated = sortedBrowse.slice((page - 1) * perPage, page * perPage);
  const addedSortedTotalPages = Math.max(1, Math.ceil(sortedAdded.length / perPage));
  const addedSortedPaginated = sortedAdded.slice((addedPage - 1) * perPage, addedPage * perPage);

  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  // Shared table row renderer for both views
  const renderItemRow = (item: PartnerItemData, mode: "browse" | "added") => {
    const isSelected = mode === "browse" ? selectedIds.has(item.id) : false;
    const isAddedSelected = mode === "added" ? addedSelectedIds.has(item.id) : false;
    const stockStyle = STOCK_STATUS_STYLES[item.stockStatus];
    const rowIsSelected = isSelected || isAddedSelected;
    const stickyCellBg = rowIsSelected
      ? "!bg-accent/30"
      : "group-hover:bg-[#F0F7FF]";
    const openQuickView = () => {
      setQuickViewData({
        type: "item",
        item: { id: item.id, name: item.partNo, subtitle: item.category, imageUrl: item.image },
        vendorName: item.manufacturer === "—" ? "" : item.manufacturer,
      });
    };
    return (
      <TableRow
        key={item.id}
        className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2 ${rowIsSelected ? "!bg-accent/30" : ""}`}
        onClick={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
      >
        {/* Checkbox — sticky leftmost */}
        <TableCell className={`sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 ${stickyCellBg}`} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={mode === "browse" ? isSelected : addedSelectedIds.has(item.id)}
            onCheckedChange={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
          />
        </TableCell>
        {/* Item Code — sticky-left at 40px (after checkbox) */}
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
                    openQuickView();
                  }}
                  className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                  title="View item details"
                >
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/5">
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-white font-mono truncate" style={{ fontWeight: 600 }}>{item.partNo}</p>
                      <p className="text-[11px] text-slate-400 truncate">{item.category} · {item.manufacturer}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 space-y-2">
                  <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between pt-1.5 border-t border-muted">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>On hand</p>
                      <p className="text-[14px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>
                        {item.onHand.toLocaleString()} <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{item.onHandUnit}</span>
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border" style={{ fontWeight: 600, color: stockStyle.color, backgroundColor: stockStyle.bg, borderColor: stockStyle.border }}>
                      {item.stockStatus}
                    </span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openQuickView(); }}
                className="text-sm font-mono text-slate-800 hover:text-primary hover:underline transition-colors cursor-pointer text-left block truncate w-full"
                style={{ fontWeight: 500 }}
                title="View item details"
              >
                {item.partNo}
              </button>
            </div>
          </div>
        </TableCell>
        {/* Description */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 400 }}>{item.description}</p>
        </TableCell>
        {/* Inventory Control */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.itemControlType}</span></TableCell>
        {/* Primary Category */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.category}</span></TableCell>
        {/* On-Hand Qty */}
        <TableCell className="text-right !pr-3 group-hover:bg-[#F0F7FF] tabular-nums">
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{item.onHand.toLocaleString()}</span>
        </TableCell>
        {/* Stocking Unit */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.onHandUnit}</span></TableCell>
        {/* Status */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <StatusBadge status={item.status} />
        </TableCell>
        {/* Acquisition */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <div className="flex items-center gap-1 whitespace-nowrap">
            {item.acquisitionMethods.map((m) => <AcqBadge key={m} method={m} />)}
          </div>
        </TableCell>
        {/* Preferred Acquisition */}
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
        {/* Actions — remove button for added view */}
        {mode === "added" && (
          <TableCell className={`sticky right-0 z-10 !px-0 ${stickyCellBg}`} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-full h-full">
              <button
                onClick={() => handleItemRemoved(item.id)}
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

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Layered above the scope filter modal; subtle blur so the
            filter behind reads as "stepped back" while you browse. */}
        <DialogOverlay
          className="z-[225] bg-black/50"
          style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
        />
        <DialogPrimitive.Content
          className={`flex flex-col p-0 gap-0 border-0 sm:border bg-white z-[230] ${modalSizeClass}`}
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Manage Items</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Add or remove items from the planning scope.</DialogPrimitive.Description>

          {/* Header */}
          <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    Manage Items
                  </h2>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                  Browse inventory to add items, or manage already added items.
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search + View tabs + Sorting pills */}
          <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
            <div className="flex items-center gap-3">
              {/* Search */}
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

              {/* View toggle */}
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

              {/* Selection count / total */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {view === "browse" && selectedIds.size > 0 && (
                  <span className="text-xs text-primary shrink-0" style={{ fontWeight: 600 }}>
                    {selectedIds.size} selected
                  </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
                  {currentTotal} {view === "browse" ? "available" : "items"}
                </span>
              </div>
            </div>

            {/* Sorting pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-2.5">
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
                    style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "hsl(var(--primary))" : undefined }}
                  >
                    {opt.label}
                    <span
                      className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                      style={{ fontWeight: 600, color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
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
                  <TableHead
                    className="text-[13px] text-foreground !pl-4 sticky left-[40px] z-20 bg-[#FAFBFC]"
                    style={{ fontWeight: 600, width: 200, minWidth: 200, maxWidth: 200, boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }}
                  >Item Code</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 260 }}>Description</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 150 }}>Inventory Control</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 150 }}>Primary Category</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4 text-right" style={{ fontWeight: 600, width: 120 }}>On-Hand Qty</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 110 }}>Stocking Unit</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 100 }}>Status</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 210 }}>Acquisition</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 180 }}>Preferred Acquisition</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 140 }}>Created On</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 200 }}>Created By</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 200 }}>Owner</TableHead>
                  {view === "added" && (
                    <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px] min-w-[60px] max-w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                      <span className="text-[13px]" />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPaginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={view === "added" ? 14 : 13} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-8 h-8" />
                        <p className="text-sm">{view === "browse" ? "No items found" : "No items added yet"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPaginated.map((item) => renderItemRow(item, view))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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

          {/* Footer — actions */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-between sm:rounded-b-2xl">
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <span style={{ fontWeight: 500 }}>
                {existingItems.length} items added
              </span>
              {view === "browse" && selectedIds.size > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-primary" style={{ fontWeight: 600 }}>{selectedIds.size} ready to add</span>
                </>
              )}
              {view === "added" && addedSelectedIds.size > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-destructive" style={{ fontWeight: 600 }}>{addedSelectedIds.size} selected</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-4 text-xs h-9 bg-white border-border text-slate-500 hover:bg-slate-50 hover:text-foreground"
              >
                Cancel
              </Button>
              {view === "added" && addedSelectedIds.size > 0 && (
                <Button
                  onClick={() => setBulkRemoveConfirmOpen(true)}
                  className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-destructive text-white hover:bg-[#B91C1C] shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
                </Button>
              )}
              {view === "added" && addedSelectedIds.size === 0 && (
                <Button
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm"
                >
                  Done
                </Button>
              )}
              {view === "browse" && (
                <Button
                  onClick={handleAdd}
                  disabled={selectedIds.size === 0}
                  className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {`Add ${selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}` : "Items"}`}
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>

    {/* Bulk remove confirmation — gradient style, layered above the modal. */}
    <Dialog open={bulkRemoveConfirmOpen} onOpenChange={setBulkRemoveConfirmOpen}>
      <DialogPortal>
        <DialogOverlay className="z-[235] bg-black/50" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[240] translate-x-[-50%] translate-y-[-50%] w-full max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit"
        >
          <DialogPrimitive.Title className="sr-only">Remove items</DialogPrimitive.Title>
          {/* Gradient header */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Remove Items
            </span>
          </div>
          {/* Content */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
              Remove {addedSelectedIds.size} item{addedSelectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <p>The following items will be removed. You can add them back later.</p>
              <div className="mt-3 max-h-[120px] overflow-y-auto text-left rounded-lg border border-border bg-slate-50">
                {Array.from(addedSelectedIds).slice(0, 10).map((id) => {
                  const item = existingItems.find((it) => it.id === id);
                  return item ? (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 border-b border-muted last:border-0">
                      <Package className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-[12px] text-slate-700 font-mono truncate" style={{ fontWeight: 500 }}>{item.partNo}</span>
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
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleBulkRemove}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
              >
                Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
              </button>
              <button
                onClick={() => setBulkRemoveConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>

    {/* Item quick-view — same shared component the listing uses. */}
    <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </>
  );
}
