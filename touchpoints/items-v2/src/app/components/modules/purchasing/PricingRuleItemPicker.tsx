// @ts-nocheck
/**
 * PricingRuleItemPicker — a faithful item-picker modal matching the Partner
 * app's `AddItemModal` BROWSE design (Partner-Management---Vendor
 * `PartnerItemsTab.tsx`, the exported `AddItemModal`, browse view). The
 * header strip, search + view-toggle row, sticky-checkbox table, pagination,
 * and "Add N Items" footer CTA are transcribed from the reference; only the
 * data bindings are swapped to OUR items (useItems) and the partner-specific
 * columns that have no analog in our Item shape (Restriction / Approved Buyer /
 * Owner) are dropped. Every Tailwind class, inline style, gradient, and copy
 * string is kept identical to the reference where it maps.
 *
 * z-index: this picker must stack ABOVE the create modal (z-[280]) and the
 * Browse Templates dialog (z-[290]) AND a parent modal whose popovers use
 * z-[260]; its DialogContent is z-[300].
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Check,
  Plus,
  Package,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useItems, INITIAL_ITEMS, type Item } from "@/app/context/ItemsContext";
import { UserCell } from "@/app/components/items-v3/UserHoverCard";

/* Image fallback — our items can carry an empty images[] array; surface a
 * neutral inventory thumbnail so every row renders a square the same way the
 * partner browse rows always have an image. */
const ITEM_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1617123623686-2b7b339785da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2NyZXclMjBib2x0fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080";

/* ── Badge styles + resolvers — ported VERBATIM from the Partner AddItemModal
 * (ACQ_BADGE_STYLES / STATUS_STYLES) so the Preferred Acquisition + Status
 * columns read identically to the partner surface. Created By / Owner reuse
 * our app-canonical UserCell (same avatar + business-card hover as partners'
 * PersonCell). */
const ACQ_BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Purchased: { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  Manufactured: { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
  Purchase: { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  Manufacturing: { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
};
const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  Inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

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

/* Owner directory mirrors src/app/pages/ItemsListPageV3.tsx (resolveOwner). */
const OWNER_DIRECTORY: Record<string, string> = {
  "user-123": "Ahtisham Ahmad",
  "user-456": "Maya Patel",
  "user-789": "Liam Chen",
};
function resolveOwnerName(ownerId: string): string {
  return OWNER_DIRECTORY[ownerId] ?? ownerId;
}
function getPrimaryAcquisitionStr(it: Item): string {
  const am = it.acquisitionMethod;
  if (typeof am === "string") return am;
  if (am && typeof am === "object" && "primary" in am) return am.primary;
  return "Purchased";
}

export interface PickedItem {
  id: string;
  partNo: string;
  description: string;
  category: string;
  image?: string;
}

/* Normalised browse-row shape mapped from our Item. Mirrors the fields the
 * reference browse table reads (partNo / description / category / control /
 * onHand / unit / status). */
interface PickerRow {
  id: string;
  partNo: string;
  description: string;
  category: string;
  itemControlType: string;
  onHand: number;
  onHandUnit: string;
  status: string;
  image: string;
  preferredAcquisition: string;
  createdOn: string;
  createdByName: string;
  ownerName: string;
}

function toRow(it: Item): PickerRow {
  return {
    id: it.id,
    partNo: it.partNumber,
    description: it.description,
    category: it.primaryCategory,
    itemControlType: it.inventoryControlType,
    onHand: it.onHandQty ?? 0,
    onHandUnit: it.unit,
    status: it.status,
    image: (it.images && it.images[0]) || ITEM_IMAGE_FALLBACK,
    preferredAcquisition: getPrimaryAcquisitionStr(it),
    createdOn: it.createdAt ?? "",
    createdByName: it.createdBy ?? "",
    ownerName: resolveOwnerName(it.ownerId),
  };
}

interface PricingRuleItemPickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingItemIds: Set<string>;
  onItemsAdded: (items: PickedItem[]) => void;
  onItemRemoved?: (id: string) => void;
  contextLabel?: string;
  contextType?: "discount" | "premium";
}

export function PricingRuleItemPicker({
  open,
  onOpenChange,
  existingItemIds,
  onItemsAdded,
  onItemRemoved,
  contextLabel,
  contextType,
}: PricingRuleItemPickerProps) {
  // Source our items from context, falling back to the seed list so the
  // picker still renders if mounted outside the provider in isolation.
  let itemsFromCtx: Item[] = INITIAL_ITEMS;
  try {
    itemsFromCtx = useItems().items;
  } catch {
    itemsFromCtx = INITIAL_ITEMS;
  }

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
      setPage(1);
    }
  }, [open]);

  const available = useMemo(() => {
    return itemsFromCtx.map(toRow).filter((it) => !existingItemIds.has(it.id));
  }, [itemsFromCtx, existingItemIds]);

  const filtered = useMemo(() => {
    let list = available;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [available, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selectedIds.size === 0) return;
    const picked: PickedItem[] = filtered
      .filter((it) => selectedIds.has(it.id))
      .map((it) => ({
        id: it.id,
        partNo: it.partNo,
        description: it.description,
        category: it.category,
        image: it.image,
      }));
    // Include any selected rows not on the current filtered page set too.
    const pickedFromAll: PickedItem[] = available
      .filter((it) => selectedIds.has(it.id) && !picked.some((p) => p.id === it.id))
      .map((it) => ({
        id: it.id,
        partNo: it.partNo,
        description: it.description,
        category: it.category,
        image: it.image,
      }));
    onItemsAdded([...picked, ...pickedFromAll]);
    onOpenChange(false);
  }

  const modalBaseTransition = "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  const renderItemRow = (item: PickerRow) => {
    const isSelected = selectedIds.has(item.id);
    const stickyCellBg = isSelected
      ? "!bg-accent/30"
      : "bg-white group-hover:bg-[#F0F7FF]";
    return (
      <TableRow
        key={item.id}
        className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2 ${isSelected ? "!bg-accent/30" : ""}`}
        onClick={() => toggleItem(item.id)}
      >
        {/* Checkbox — sticky leftmost (matches main table) */}
        <TableCell className={`sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 ${stickyCellBg}`} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleItem(item.id)}
          />
        </TableCell>
        {/* Item Code — sticky-left at 40px (after checkbox) */}
        <TableCell
          className={`sticky left-[40px] z-10 ${stickyCellBg}`}
          style={{ boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)", width: 200, minWidth: 200, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0 border border-[#E8ECF1]"
              title="Item"
            >
              <img src={item.image} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <span
                className="text-sm font-mono text-slate-800 transition-colors text-left block truncate w-full"
                style={{ fontWeight: 500 }}
                title={item.partNo}
              >
                {item.partNo}
              </span>
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
        {/* On-Hand Qty (single line, matches main tab) */}
        <TableCell className="text-right !pr-3 group-hover:bg-[#F0F7FF] tabular-nums">
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{(item.onHand ?? 0).toLocaleString()}</span>
        </TableCell>
        {/* Base Unit */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><span className="text-sm text-slate-700 whitespace-nowrap">{item.onHandUnit}</span></TableCell>
        {/* Status */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <StatusBadge status={item.status} />
        </TableCell>
        {/* Preferred Acquisition */}
        <TableCell className="group-hover:bg-[#F0F7FF]"><AcqBadge method={item.preferredAcquisition} /></TableCell>
        {/* Created On */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <span className="text-sm text-slate-700 whitespace-nowrap">
            {(() => { const d = new Date(item.createdOn); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); })()}
          </span>
        </TableCell>
        {/* Created By — reuses our app-canonical UserCell (partner PersonCell parity). */}
        <TableCell className="group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <UserCell name={item.createdByName} subtitle="Created by" />
        </TableCell>
        {/* Owner */}
        <TableCell className="group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <UserCell name={item.ownerName} subtitle="Owner" />
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[300] ${modalSizeClass}`}
        hideCloseButton
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Manage Items</DialogTitle>
        <DialogDescription className="sr-only">Add or remove items for this pricing rule.</DialogDescription>

        {/* Header */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                  Manage Items
                </h2>
                {/* Context label — e.g. pricing rule name, colored by type */}
                {contextLabel && (
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
                Select items to assign to this pricing rule.
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

        {/* Search + Count */}
        <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search inventory..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pr-8 h-8 text-[13px] bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {selectedIds.size > 0 && (
                <span className="text-xs text-primary shrink-0" style={{ fontWeight: 600 }}>
                  {selectedIds.size} selected
                </span>
              )}
              <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
                {filtered.length} available
              </span>
            </div>
          </div>
          <div className="h-2.5" />
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <Table style={{ tableLayout: "fixed", minWidth: 2060 }}>
            <TableHeader className="sticky top-0 z-20 bg-white">
              <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                  <Checkbox
                    checked={paginated.length > 0 && paginated.every((it) => selectedIds.has(it.id)) ? true : paginated.some((it) => selectedIds.has(it.id)) ? "indeterminate" : false}
                    onCheckedChange={() => {
                      const allSelected = paginated.every((it) => selectedIds.has(it.id));
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        paginated.forEach((it) => allSelected ? next.delete(it.id) : next.add(it.id));
                        return next;
                      });
                    }}
                  />
                </TableHead>
                <TableHead
                  className="text-[11px] text-slate-500 !pl-4 sticky left-[40px] z-20 bg-[#FAFBFC]"
                  style={{ fontWeight: 500, width: 200, minWidth: 200, maxWidth: 200, boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }}
                >Item Code</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 260 }}>Description</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 150 }}>Inventory Control</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 150 }}>Primary Category</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4 text-right" style={{ fontWeight: 500, width: 120 }}>On-Hand Qty</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 110 }}>Base Unit</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 100 }}>Status</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 180 }}>Preferred Acquisition</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 140 }}>Created On</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 200 }}>Created By</TableHead>
                <TableHead className="text-[11px] text-slate-500 !pl-4" style={{ fontWeight: 500, width: 200 }}>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8" />
                      <p className="text-sm">No items found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => renderItemRow(item))
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
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={page === 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </Button>

            {(() => {
              const pages: (number | "...")[] = [];
              if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
              else { pages.push(1); if (page > 3) pages.push("..."); for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i); if (page < totalPages - 2) pages.push("..."); pages.push(totalPages); }
              return pages.map((p, idx) => p === "..." ? (
                <span key={`d${idx}`} className="px-1 text-muted-foreground text-[13px]">...</span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 text-[13px] ${
                    page === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              ));
            })()}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={page === totalPages}
              onClick={() => setPage(Math.min(totalPages, page + 1))}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Footer — Cancel + Add N Items */}
        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
          <div className="flex items-center gap-2 text-[12px] text-slate-500 mr-auto">
            <span style={{ fontWeight: 500 }}>
              {filtered.length} available
            </span>
            {selectedIds.size > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-primary" style={{ fontWeight: 600 }}>
                  {selectedIds.size} ready to add
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0}
            className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {`Add ${selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}` : "Items"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PricingRuleItemPicker;
