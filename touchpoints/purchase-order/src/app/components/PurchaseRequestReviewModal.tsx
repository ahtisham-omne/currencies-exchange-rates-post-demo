/* ═══════════════════════════════════════════════════════════════
   PurchaseRequestReviewModal — single-surface review + submit
   ───────────────────────────────────────────────────────────────
   Replaces the wizard's Step 2 + Step 3 for the "Existing item"
   path. The buyer picks items in ItemsCatalogueModal, taps the
   "Continue to request" pill, and lands here. Layout mirrors the
   ItemsCatalogueModal cart-view shell (two-column, rounded card
   groups) so the two review surfaces feel like siblings.

   LEFT column — items grouped by preferred vendor (mirrors PO
   cart grouping). Each row exposes the fields captured by the
   PR wizard's Step 2:
     · quantity (stepper)
     · UOM (native select)
     · estimated unit price (optional)
     · preferred vendor (dropdown, seeded from partnerLocation)
     · remove

   RIGHT column — sticky "Request details" sidebar mirroring the
   PO cart's Order Summary. Captures Step-3 fields:
     · need-by date
     · urgency (radio with suggested-urgency hint)
     · reason (required textarea)
     · reference doc (optional)
     · attachments
   Ends with the primary Submit CTA.

   Submit shape matches PurchaseRequestForm.handleSubmit exactly
   so the PR record produced is indistinguishable from a wizard
   submission.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  FileText,
  Info,
  Minus,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ItemHoverCard from "./ItemHoverCard";
import ConfigFlagModal from "./ConfigFlagModal";
import MultiplePRsCreatedModal, {
  type CreatedPRSummary,
} from "./MultiplePRsCreatedModal";
import { FONT } from "./designTokens";
import { CATALOG, type CatalogItem } from "./catalogData";
import {
  addPR,
  suggestUrgency,
  URGENCY_META,
  type PRAttachment,
  type PRLineItem,
  type PRUrgency,
} from "./prData";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface RowFields {
  quantity: string;
  uom: string;
  estimatedPrice: string;
  preferredVendor: string;
}

const EMPTY_ROW: RowFields = {
  quantity: "1",
  uom: "",
  estimatedPrice: "",
  preferredVendor: "",
};

interface VendorGroup {
  vendor: string;
  items: CatalogItem[];
}

interface PurchaseRequestReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids from the catalogue picker. Resolved against CATALOG on open. */
  itemIds: string[];
  /** Fires when the buyer removes an item from within the review so
   *  the host can keep its `catalogPicks` state in sync. */
  onRemoveItem?: (id: string) => void;
  /** Fires when the buyer taps "Back to items" — the host should
   *  reopen the catalogue modal with the current picks preserved. */
  onBackToItems: () => void;
  /** Called after a successful `addPR` so the host can navigate to
   *  the newly created PR detail. */
  onSuccess?: (prId: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const UOM_OPTIONS = [
  "EA",
  "Each",
  "Kit",
  "Case",
  "Box",
  "Pack",
  "Unit",
  "Module",
  "Assembly",
];

/* ── Vendor avatar tint (mirrors CatalogueModal's AvatarCircle) ── */
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
const VENDOR_ABBR_MAP: Record<string, string> = {
  "General Motors (GM)": "GM",
  "Toyota Technical Center (TTC)": "TTC",
  "Ford Motor Company": "FMC",
  "Tesla, Inc.": "T",
  "Chrysler (Stellantis N.V.)": "CS",
  "Rivian Automotive": "RA",
  "Lucid Motors": "LM",
  "Honda Motor Co., Ltd. (USA)": "HM",
  "Nissan North America": "NNA",
  "BMW of North America": "BMW",
};
function avatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function AvatarCircle({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  const t = avatarTint(name);
  const initials =
    VENDOR_ABBR_MAP[name] ??
    name
      .split(/[\s(]+/)
      .filter(Boolean)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 3)
      .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size <= 24 ? "9px" : "10.5px",
        fontWeight: 700,
        fontFamily: FONT,
        backgroundColor: t.bg,
        color: t.text,
      }}
    >
      {initials}
    </span>
  );
}

/** Group items by their preferred vendor (seeded from
 *  `partnerLocation`, overridden by any per-row edit). Preserves
 *  the pick order within each group. */
function groupItems(
  items: CatalogItem[],
  perRow: Record<string, RowFields>,
): VendorGroup[] {
  const map = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const vendor =
      (perRow[item.id]?.preferredVendor || "").trim() ||
      item.partnerLocation ||
      "No vendor";
    const existing = map.get(vendor);
    if (existing) existing.push(item);
    else map.set(vendor, [item]);
  }
  return Array.from(map.entries()).map(([vendor, its]) => ({
    vendor,
    items: its,
  }));
}

/** A catalog item's list price in USD, as the design writes it: requests
 *  estimate in USD (catalog prices are now in each vendor's currency). */
function listUsd(item: CatalogItem): number {
  return item.listPriceUsd ?? item.unitPrice ?? 0;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PurchaseRequestReviewModal({
  open,
  onOpenChange,
  itemIds,
  onRemoveItem,
  onBackToItems,
  onSuccess,
}: PurchaseRequestReviewModalProps) {
  /* ── Resolve items from ids (memoised so React doesn't reshuffle
        row keys mid-edit) ────────────────────────────────────── */
  const items = useMemo(
    () =>
      itemIds
        .map((id) => CATALOG.find((c) => c.id === id))
        .filter((c): c is CatalogItem => Boolean(c)),
    [itemIds],
  );

  /* ── Per-row fields ── keyed by catalog item id. Reset on open. */
  const [perRow, setPerRow] = useState<Record<string, RowFields>>({});
  /* Checkbox + collapse state (mirrors the PO cart accordion). Every
     item starts checked; unchecking excludes it from submission.
     Collapsed vendors hide their item lists but the group header
     and its aggregate counts stay visible. */
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowFields> = {};
    for (const item of items) {
      next[item.id] = {
        ...EMPTY_ROW,
        uom: item.defaultUOM || "EA",
        /* Pre-fill unit price from the catalogue so buyers see the
           list price without needing to look it up. Still editable. */
        estimatedPrice: listUsd(item) > 0 ? String(listUsd(item)) : "",
        /* Preferred vendor is captured invisibly here — it flows into
           the submitted PR — but the UI is hidden because vendor is
           already made explicit by the group heading. */
        preferredVendor: item.partnerLocation ?? "",
      };
    }
    setPerRow(next);
    setCheckedItems(new Set(items.map((i) => i.id)));
    setCollapsedVendors(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemIds.join("|")]);

  const toggleCheck = (id: string) =>
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleVendorAll = (vendor: string, groupItems: CatalogItem[]) =>
    setCheckedItems((prev) => {
      const next = new Set(prev);
      const allChecked = groupItems.every((i) => next.has(i.id));
      if (allChecked) groupItems.forEach((i) => next.delete(i.id));
      else groupItems.forEach((i) => next.add(i.id));
      return next;
    });
  const toggleVendorCollapse = (vendor: string) =>
    setCollapsedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });

  /* ── Config-flag side-flow — opens a smaller modal on top when
        the buyer taps "Flag" on a below-min row. Files a separate
        config-issue PR without touching this request. Items that
        have already been flagged in this session stay marked so the
        buyer sees the after-state and doesn't accidentally file a
        second flag for the same item. */
  const [configFlagItemId, setConfigFlagItemId] = useState<string | null>(
    null,
  );
  /* Post-submit modal — only shown when the buyer's checked items
     span more than one preferred vendor and we've split the
     submission into multiple PRs. */
  const [multiCreated, setMultiCreated] = useState<CreatedPRSummary[] | null>(
    null,
  );
  const [flaggedItemIds, setFlaggedItemIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setFlaggedItemIds(new Set());
  }, [open, itemIds.join("|")]);

  /* ── Shared request-details state ── */
  const [needBy, setNeedBy] = useState("");
  const [urgency, setUrgency] = useState<PRUrgency>("standard");
  const [reason, setReason] = useState("");
  const [referenceDoc, setReferenceDoc] = useState("");
  const [attachments, setAttachments] = useState<PRAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [needByOpen, setNeedByOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    setNeedBy("");
    setUrgency("standard");
    setReason("");
    setReferenceDoc("");
    setAttachments([]);
    setSubmitting(false);
    setTriedSubmit(false);
  }, [open]);

  /* ── Suggested urgency (same helper the wizard uses).
        We surface the aggregate min-stock signal by summing across
        picked items so the hint fires when the whole basket is at
        risk, not per-item. */
  const stockAggregate = useMemo(() => {
    const currentStock = items.reduce(
      (sum, item) => sum + (item.currentStock ?? 0),
      0,
    );
    const minStock = items.reduce(
      (sum, item) => sum + (item.minQuantity ?? 0),
      0,
    );
    return { currentStock, minStock };
  }, [items]);
  const suggestedUrgency = useMemo(
    () =>
      suggestUrgency({
        needByISO: needBy || undefined,
        currentStock: stockAggregate.currentStock,
        minStock: stockAggregate.minStock,
      }),
    [needBy, stockAggregate],
  );

  const vendorGroups = useMemo(
    () => groupItems(items, perRow),
    [items, perRow],
  );
  /* Only checked items count toward totals + submission — matches
     the PO cart's "N of M items selected" behavior. */
  const checkedList = useMemo(
    () => items.filter((i) => checkedItems.has(i.id)),
    [items, checkedItems],
  );
  const totalQty = useMemo(
    () =>
      checkedList.reduce(
        (sum, item) => sum + (parseFloat(perRow[item.id]?.quantity ?? "0") || 0),
        0,
      ),
    [checkedList, perRow],
  );
  const estimatedTotal = useMemo(
    () =>
      checkedList.reduce((sum, item) => {
        const fields = perRow[item.id];
        if (!fields) return sum;
        const qty = parseFloat(fields.quantity) || 0;
        const price = fields.estimatedPrice
          ? parseFloat(fields.estimatedPrice) || 0
          : listUsd(item);
        return sum + qty * price;
      }, 0),
    [checkedList, perRow],
  );

  /* ── Validation — only against checked items ── */
  const rowErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const item of checkedList) {
      const f = perRow[item.id];
      if (!f) continue;
      const qty = parseFloat(f.quantity);
      if (!qty || qty <= 0) errs[item.id] = "Quantity is required";
    }
    return errs;
  }, [checkedList, perRow]);

  const noItems = items.length === 0;
  const nothingChecked = !noItems && checkedList.length === 0;
  const reasonError = reason.trim().length === 0;
  const canSubmit =
    !noItems &&
    !nothingChecked &&
    Object.keys(rowErrors).length === 0 &&
    !reasonError;

  const patch = (id: string, patch: Partial<RowFields>) =>
    setPerRow((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const removeItem = (id: string) => {
    setPerRow((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    onRemoveItem?.(id);
  };

  const attach = (file: File) =>
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        filename: file.name,
        sizeKb: Math.round(file.size / 1024),
      },
    ]);

  /* Vendor for grouping — the buyer's per-row override wins, else
     the catalogue vendor, else a shared "No vendor" bucket. */
  const vendorKey = (item: CatalogItem): string =>
    (perRow[item.id]?.preferredVendor || "").trim() ||
    item.partnerLocation ||
    "No vendor";

  const handleSubmit = () => {
    setTriedSubmit(true);
    if (!canSubmit) {
      toast.error(
        nothingChecked
          ? "Select at least one item to submit"
          : "Fix the highlighted fields before submitting",
        { style: { fontFamily: FONT } },
      );
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      /* Group checked items by vendor so we can enforce the
         "single vendor per PR" invariant. When the basket spans
         multiple vendors we submit one addPR per group. */
      const byVendor = new Map<string, CatalogItem[]>();
      for (const item of checkedList) {
        const key = vendorKey(item);
        const bucket = byVendor.get(key);
        if (bucket) bucket.push(item);
        else byVendor.set(key, [item]);
      }
      const groups = Array.from(byVendor.entries());
      const createdSummaries: CreatedPRSummary[] = [];
      let firstId = "";
      groups.forEach(([vendor, groupItems], groupIdx) => {
        const lineItems: PRLineItem[] = groupItems.map((item, idx) => {
          const f = perRow[item.id];
          return {
            id: `li-cat-${item.id}-${idx}`,
            itemId: item.id,
            isNewItem: false,
            quantity: parseFloat(f.quantity) || 0,
            uom: f.uom || item.defaultUOM || "EA",
            estimatedUnitPrice: f.estimatedPrice
              ? parseFloat(f.estimatedPrice)
              : undefined,
            preferredVendor: f.preferredVendor || undefined,
          };
        });
        const record = addPR({
          lineItems,
          needBy,
          urgency,
          reason: reason.trim(),
          referenceDoc: referenceDoc.trim() || undefined,
          attachments,
        });
        if (groupIdx === 0) firstId = record.id;
        const total = groupItems.reduce((sum, item) => {
          const f = perRow[item.id];
          const qty = parseFloat(f?.quantity ?? "0") || 0;
          const price = f?.estimatedPrice
            ? parseFloat(f.estimatedPrice) || 0
            : listUsd(item);
          return sum + qty * price;
        }, 0);
        createdSummaries.push({
          id: record.id,
          vendor,
          itemCount: lineItems.length,
          total,
        });
      });

      if (createdSummaries.length > 1) {
        /* Multi-vendor split — hold the confirmation modal open
           after the review closes so the buyer can pick which
           requests to open next. */
        toast.success(
          `${createdSummaries.length} purchase requests submitted`,
          {
            description: "One per vendor — split from your basket",
            style: { fontFamily: FONT },
          },
        );
        setMultiCreated(createdSummaries);
        onOpenChange(false);
      } else {
        toast.success(
          createdSummaries[0].itemCount === 1
            ? "Purchase request submitted"
            : `Purchase request submitted with ${createdSummaries[0].itemCount} items`,
          {
            description: `${firstId} is waiting for buyer review`,
            style: { fontFamily: FONT },
          },
        );
        onOpenChange(false);
        onSuccess?.(firstId);
      }
    }, 220);
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden border-0 sm:border [&>[data-slot=dialog-close]]:hidden !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl"
        style={{
          backgroundColor: "hsl(var(--card))",
          fontFamily: FONT,
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Review Purchase Request</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm quantities, timing, and reason before submitting the request.
        </DialogDescription>

        {/* ═════════ HEADER ══════════ */}
        <div className="shrink-0 z-10 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-3.5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onBackToItems();
                  }}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                  title="Back to items"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: "32px",
                    height: "32px",
                    backgroundColor: "hsl(var(--accent))",
                  }}
                >
                  <FileText
                    style={{
                      width: "16px",
                      height: "16px",
                      color: "hsl(var(--primary))",
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h2
                    className="!text-[15px] sm:!text-[17px] !text-foreground truncate !leading-tight !font-bold"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    Review Purchase Request
                  </h2>
                  <p className="!text-[11px] sm:!text-xs !text-slate-500 mt-0.5 truncate !font-normal">
                    {items.length > 0
                      ? `${vendorGroups.length} vendor${vendorGroups.length !== 1 ? "s" : ""} · ${checkedList.length} of ${items.length} item${items.length !== 1 ? "s" : ""} selected`
                      : "No items on this request yet. Go back to add some."}
                  </p>
                </div>
              </div>

              {/* Right-hand cluster — close only. Submit CTA lives in
                  the right sidebar as the sole primary action so
                  buyers commit to it after they've filled details. */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════ BODY — two columns ══════════
             `min-h-0` on the flex child is critical: without it the
             inner overflow-y-auto grows the parent instead of
             scrolling, and long item lists spill off the modal. */}
        <div
          className="flex-1 flex flex-col min-w-0 min-h-0"
          style={{ backgroundColor: "#FAFBFC" }}
        >
          {noItems ? (
            <div className="flex-1 flex items-center justify-center px-6 py-16">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">
                  No items on this request
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Go back to the catalog to add at least one item.
                </p>
                <Button
                  className="mt-4 h-8 rounded-lg text-[12px]"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onBackToItems();
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to items
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 overflow-y-auto"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "hsl(var(--border)) transparent",
              }}
            >
              <div className="px-5 py-5">
                <div className="flex flex-col lg:flex-row gap-5">
                  {/* ── LEFT: items grouped by vendor (accordion) ── */}
                  <div className="flex-1 min-w-0 flex flex-col gap-4">
                    {vendorGroups.map((group) => {
                      const isCollapsed = collapsedVendors.has(group.vendor);
                      const groupCheckedCount = group.items.filter((i) =>
                        checkedItems.has(i.id),
                      ).length;
                      const allChecked =
                        groupCheckedCount === group.items.length;
                      const someChecked =
                        groupCheckedCount > 0 && !allChecked;
                      const groupSubtotal = group.items.reduce((sum, item) => {
                        if (!checkedItems.has(item.id)) return sum;
                        const f = perRow[item.id];
                        if (!f) return sum;
                        const qty = parseFloat(f.quantity) || 0;
                        const price = f.estimatedPrice
                          ? parseFloat(f.estimatedPrice) || 0
                          : listUsd(item);
                        return sum + qty * price;
                      }, 0);
                      return (
                        <div
                          key={group.vendor}
                          className="rounded-[var(--radius-lg)] border border-border overflow-hidden bg-card"
                        >
                          {/* Vendor header — click to collapse. Checkbox
                              stops propagation so it doesn't toggle the
                              accordion when a buyer selects-all. */}
                          <div
                            className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-accent/40 transition-colors"
                            style={{
                              borderBottom: isCollapsed
                                ? "none"
                                : "1px solid hsl(var(--border))",
                            }}
                            onClick={() => toggleVendorCollapse(group.vendor)}
                          >
                            <div
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={
                                  allChecked
                                    ? true
                                    : someChecked
                                      ? "indeterminate"
                                      : false
                                }
                                onCheckedChange={() =>
                                  toggleVendorAll(group.vendor, group.items)
                                }
                                className="size-[18px]"
                                aria-label={
                                  allChecked ? "Deselect all" : "Select all"
                                }
                              />
                            </div>
                            <AvatarCircle name={group.vendor} size={32} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-foreground truncate text-sm leading-[20px]"
                                  style={{ fontWeight: 600 }}
                                >
                                  {group.vendor}
                                </span>
                                <span
                                  className="inline-flex items-center px-1.5 py-0 rounded-full shrink-0 bg-muted text-muted-foreground text-[10px] leading-[16px]"
                                  style={{ fontWeight: 600 }}
                                >
                                  {groupCheckedCount}/{group.items.length}{" "}
                                  selected
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span
                                  className="text-muted-foreground text-xs leading-[16px]"
                                  style={{ fontWeight: 400 }}
                                >
                                  Subtotal:{" "}
                                  <span
                                    className="text-foreground tabular-nums"
                                    style={{ fontWeight: 600 }}
                                  >
                                    ${groupSubtotal.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ChevronDown
                                className="size-4 text-muted-foreground transition-transform duration-200"
                                style={{
                                  transform: isCollapsed
                                    ? "rotate(-90deg)"
                                    : "rotate(0deg)",
                                }}
                              />
                            </div>
                          </div>

                          {/* Vendor items — collapsed = hidden */}
                          {!isCollapsed && (
                            <div className="flex flex-col gap-0 px-3 pt-2 pb-3">
                              {group.items.map((item) => {
                                const fields = perRow[item.id] ?? EMPTY_ROW;
                                const isChecked = checkedItems.has(item.id);
                                const hasError =
                                  triedSubmit &&
                                  isChecked &&
                                  Boolean(rowErrors[item.id]);
                                return (
                                  <ItemRow
                                    key={item.id}
                                    item={item}
                                    fields={fields}
                                    isChecked={isChecked}
                                    isFlagged={flaggedItemIds.has(item.id)}
                                    onToggleCheck={() => toggleCheck(item.id)}
                                    onPatch={(p) => patch(item.id, p)}
                                    onRemove={() => removeItem(item.id)}
                                    onFlagConfig={() =>
                                      setConfigFlagItemId(item.id)
                                    }
                                    hasError={hasError}
                                    errorMessage={rowErrors[item.id]}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── RIGHT: request details sidebar ── */}
                  <div className="lg:w-[360px] xl:w-[400px] shrink-0">
                    <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden lg:sticky lg:top-4">
                      {/* Card header — quieter now that sections carry
                          the copy weight. */}
                      <div className="px-4 py-3 border-b border-border">
                        <p
                          className="text-[13.5px] text-foreground leading-tight"
                          style={{ fontWeight: 600, letterSpacing: "-0.005em" }}
                        >
                          Request details
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          These apply to the whole request.
                        </p>
                      </div>

                      {/* SECTION 1 — Timing. Two tightly paired
                          fields (need-by drives the urgency
                          suggestion) grouped under one eyebrow. */}
                      <div className="px-4 pt-3 pb-4 border-b border-border">
                        <SectionEyebrow>Timing</SectionEyebrow>
                        <div className="mt-2 flex flex-col gap-3">
                          <CompactField label="Need by" required>
                            <Popover
                              open={needByOpen}
                              onOpenChange={setNeedByOpen}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`inline-flex w-full items-center gap-2 h-9 rounded-md border px-2.5 text-[12.5px] transition-colors hover:bg-muted/40 ${
                                    needBy
                                      ? "text-foreground"
                                      : "text-muted-foreground"
                                  } ${
                                    triedSubmit && !needBy
                                      ? "border-red-400"
                                      : "border-border"
                                  }`}
                                  style={{ fontFamily: FONT }}
                                >
                                  <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
                                  <span
                                    className="tabular-nums"
                                    style={{ fontWeight: needBy ? 500 : 400 }}
                                  >
                                    {needBy ? fmtDate(needBy) : "Pick a date"}
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0 z-[220]"
                                align="start"
                                sideOffset={6}
                              >
                                <Calendar
                                  mode="single"
                                  selected={
                                    needBy ? new Date(needBy) : undefined
                                  }
                                  onSelect={(d) => {
                                    if (d) {
                                      const y = d.getFullYear();
                                      const m = String(
                                        d.getMonth() + 1,
                                      ).padStart(2, "0");
                                      const day = String(
                                        d.getDate(),
                                      ).padStart(2, "0");
                                      setNeedBy(`${y}-${m}-${day}`);
                                      setNeedByOpen(false);
                                    }
                                  }}
                                  disabled={[{ before: new Date() }]}
                                  initialFocus
                                  showOutsideDays={false}
                                />
                              </PopoverContent>
                            </Popover>
                          </CompactField>

                          <CompactField
                            label="Urgency"
                            trailing={
                              suggestedUrgency && suggestedUrgency !== urgency ? (
                                <button
                                  type="button"
                                  onClick={() => setUrgency(suggestedUrgency)}
                                  className="inline-flex items-center gap-1 text-[10.5px] text-primary hover:text-blue-700 transition-colors"
                                  style={{ fontWeight: 600 }}
                                >
                                  <Info className="w-2.5 h-2.5" />
                                  Suggest {URGENCY_META[suggestedUrgency].label}
                                </button>
                              ) : null
                            }
                          >
                            <div className="grid grid-cols-3 gap-1.5">
                              {(
                                ["low", "standard", "high"] as PRUrgency[]
                              ).map((u) => {
                                const meta = URGENCY_META[u];
                                const active = urgency === u;
                                return (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => setUrgency(u)}
                                    className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md border transition-all"
                                    style={{
                                      fontFamily: FONT,
                                      fontSize: 11.5,
                                      backgroundColor: active
                                        ? meta.bg
                                        : "hsl(var(--card))",
                                      borderColor: active
                                        ? meta.border
                                        : "hsl(var(--border))",
                                      color: active
                                        ? meta.fg
                                        : "hsl(var(--muted-foreground))",
                                      fontWeight: active ? 600 : 500,
                                    }}
                                  >
                                    <span
                                      aria-hidden
                                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: active
                                          ? meta.fg
                                          : "hsl(var(--muted-foreground))",
                                        opacity: active ? 1 : 0.4,
                                      }}
                                    />
                                    {meta.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p
                              className="mt-1.5 text-[10.5px] text-slate-500"
                              style={{ fontFamily: FONT, fontWeight: 400 }}
                            >
                              Manually mark how urgent this request is. It does not affect timelines or trigger any automated action.
                            </p>
                          </CompactField>
                        </div>
                      </div>

                      {/* SECTION 2 — Context. Reason is the required
                          anchor; the two optional fields sit under it in
                          a quieter cluster. */}
                      <div className="px-4 pt-3 pb-4">
                        <SectionEyebrow>Context</SectionEyebrow>
                        <div className="mt-2 flex flex-col gap-3">
                          <CompactField label="Reason" required>
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Why is this request needed?"
                              rows={3}
                              className={`w-full rounded-md border px-2.5 py-1.5 text-[12.5px] leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                                triedSubmit && reasonError
                                  ? "border-red-400"
                                  : "border-border"
                              }`}
                              style={{ fontFamily: FONT }}
                            />
                          </CompactField>

                          <CompactField label="Reference document" optional>
                            <input
                              type="text"
                              value={referenceDoc}
                              onChange={(e) => setReferenceDoc(e.target.value)}
                              placeholder="WO-1234, SO-5678, quote link..."
                              className="w-full rounded-md border border-border px-2.5 h-9 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{ fontFamily: FONT }}
                            />
                          </CompactField>

                          <CompactField label="Attachments" optional>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12px] text-primary hover:text-blue-700 transition-colors">
                              <Upload className="w-3.5 h-3.5" />
                              <span style={{ fontWeight: 600 }}>
                                Add a file
                              </span>
                              <input
                                type="file"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) attach(file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {attachments.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1.5">
                                {attachments.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center gap-2 rounded-md border border-border bg-[#FAFBFC] px-2 py-1.5"
                                  >
                                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                                    <span
                                      className="text-[11px] text-foreground truncate flex-1"
                                      style={{ fontWeight: 500 }}
                                      title={a.filename}
                                    >
                                      {a.filename}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      {a.sizeKb} KB
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAttachments((prev) =>
                                          prev.filter((x) => x.id !== a.id),
                                        )
                                      }
                                      className="text-slate-400 hover:text-red-500 shrink-0"
                                      aria-label={`Remove ${a.filename}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CompactField>
                        </div>
                      </div>

                      {/* Footer — summary + primary CTA sit in a
                          tinted well so they feel like a distinct
                          checkout region rather than another field. */}
                      <div className="border-t border-border bg-[#FAFBFC] px-4 py-3.5 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <SummaryRow
                            label="Total units"
                            value={totalQty.toLocaleString()}
                          />
                          <SummaryRow
                            label="Estimated value"
                            value={`$${estimatedTotal.toFixed(2)}`}
                            emphasis
                          />
                        </div>
                        <Button
                          onClick={handleSubmit}
                          disabled={!canSubmit || submitting}
                          className="w-full gap-1.5 rounded-lg h-10 text-[13px] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {submitting
                            ? "Submitting..."
                            : `Submit request${items.length > 1 ? ` (${items.length})` : ""}`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      {/* Config-flag modal renders as a sibling Dialog so Radix stacks
          it on top of the review modal (higher z from being mounted
          later + its own Portal). Closing it returns focus to the
          review modal, which stays open. */}
      <ConfigFlagModal
        open={configFlagItemId !== null}
        onOpenChange={(o) => {
          if (!o) setConfigFlagItemId(null);
        }}
        itemId={configFlagItemId ?? undefined}
        onSuccess={() => {
          if (configFlagItemId) {
            setFlaggedItemIds((prev) => {
              const next = new Set(prev);
              next.add(configFlagItemId);
              return next;
            });
          }
          setConfigFlagItemId(null);
        }}
      />
      {/* Multi-PR confirmation — only mounts when the buyer's
          basket spanned >1 vendor and we split into N requests. */}
      <MultiplePRsCreatedModal
        open={multiCreated !== null}
        onOpenChange={(o) => {
          if (!o) setMultiCreated(null);
        }}
        created={multiCreated ?? []}
        onBackToList={() => setMultiCreated(null)}
        onOpen={(ids) => {
          setMultiCreated(null);
          if (ids.length > 0) onSuccess?.(ids[0]);
        }}
      />
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ITEM ROW — mirrors the PO cart line-item card recipe but with
   PR fields inline
   ═══════════════════════════════════════════════════════════════ */

function ItemRow({
  item,
  fields,
  isChecked,
  isFlagged,
  onToggleCheck,
  onPatch,
  onRemove,
  onFlagConfig,
  hasError,
  errorMessage,
}: {
  item: CatalogItem;
  fields: RowFields;
  isChecked: boolean;
  isFlagged: boolean;
  onToggleCheck: () => void;
  onPatch: (patch: Partial<RowFields>) => void;
  onRemove: () => void;
  onFlagConfig: () => void;
  hasError: boolean;
  errorMessage?: string;
}) {
  /* Config-flag trigger only surfaces when the item's on-hand is at
     or below its min — same "something might be off" signal the
     wizard used. Once a buyer has filed a flag we keep the button
     visible regardless (in a green "Flagged" state) so they see
     confirmation of their own action. */
  const showConfigFlagHint =
    isFlagged || item.currentStock <= item.minQuantity;
  const stepQty = (delta: number) => {
    const current = parseFloat(fields.quantity) || 0;
    const next = Math.max(0, current + delta);
    onPatch({ quantity: String(next) });
  };
  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-150 mb-2 group/card ${
        hasError
          ? "border-red-300 bg-red-50/20"
          : isChecked
            ? "border-border bg-card hover:border-primary/20 hover:shadow-sm"
            : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Checkbox — top-aligned so it sits next to the item title */}
        <div className="shrink-0 mt-2">
          <Checkbox
            checked={isChecked}
            onCheckedChange={onToggleCheck}
            className="size-[18px]"
            aria-label={isChecked ? "Deselect item" : "Select item"}
          />
        </div>
        {/* Thumbnail */}
        <div className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted border border-border">
          <ImageWithFallback
            src={item.image}
            alt={item.descriptiveName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Identity */}
        <div className="flex flex-col flex-1 min-w-0 gap-0">
          <div className="flex items-center gap-2">
            <ItemHoverCard code={item.itemNumber} imageUrl={item.image}>
              <span
                className="text-foreground truncate text-sm leading-[20px] cursor-pointer hover:text-primary transition-colors"
                style={{ fontWeight: 600 }}
              >
                {item.itemNumber}
              </span>
            </ItemHoverCard>
            {item.category && (
              <span
                className="inline-flex items-center px-1.5 py-0 rounded-md shrink-0 bg-muted text-muted-foreground text-[10px] leading-[16px]"
                style={{ fontWeight: 600 }}
              >
                {item.category}
              </span>
            )}
          </div>
          <p
            className="text-muted-foreground text-[12px] leading-[16px] mt-0.5 line-clamp-1"
            title={item.descriptiveName}
          >
            {item.descriptiveName}
          </p>
          {/* Stock chip — tone shifts with health so a floor worker
              scanning the review can see at a glance which items are
              actually below min and driving the request. */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StockChip
              current={item.currentStock}
              min={item.minQuantity}
            />
            <span
              className="text-muted-foreground text-[11px] leading-[16px]"
              style={{ fontWeight: 500 }}
            >
              List{" "}
              <span
                className="text-foreground tabular-nums"
                style={{ fontWeight: 600 }}
              >
                ${listUsd(item).toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 flex items-center justify-center"
          title="Remove from request"
          aria-label={`Remove ${item.itemNumber}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Field row — both fields left-aligned and compact.
          Quantity+UOM stays as one combined pill (cart parity); Est.
          unit price sits next to it as a separate, narrow input so it
          doesn't stretch across the row. Preferred vendor is hidden
          because items are already grouped by vendor above. */}
      <div className="flex items-end flex-wrap gap-x-4 gap-y-2 px-3 py-2 border-t border-border bg-[#FAFBFC]">
        {/* Qty + UOM (single combined field) */}
        <RowField
          label="Quantity"
          required
          error={hasError ? errorMessage : undefined}
        >
          <div className="inline-flex items-stretch h-8 rounded-md border border-border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => stepQty(-1)}
              disabled={(parseFloat(fields.quantity) || 0) <= 0}
              className="grid w-7 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={fields.quantity}
              onChange={(e) => onPatch({ quantity: e.target.value })}
              className="w-12 text-center text-[12px] bg-transparent focus:outline-none tabular-nums"
            />
            <button
              type="button"
              onClick={() => stepQty(1)}
              className="grid w-7 place-items-center text-slate-500 hover:bg-slate-50"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
            <span aria-hidden className="w-px h-full bg-border shrink-0" />
            <div className="relative shrink-0">
              <select
                value={fields.uom}
                onChange={(e) => onPatch({ uom: e.target.value })}
                aria-label="Unit of measure"
                className="h-full pl-2 pr-5 text-[11.5px] appearance-none bg-transparent text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {!UOM_OPTIONS.includes(fields.uom) && fields.uom && (
                  <option value={fields.uom}>{fields.uom}</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
          </div>
        </RowField>

        {/* Estimated price — separate, narrow input to the right of qty */}
        <RowField label="Est. unit price">
          <div className="relative w-[110px]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={fields.estimatedPrice}
              onChange={(e) => onPatch({ estimatedPrice: e.target.value })}
              placeholder="0.00"
              className="w-full h-8 rounded-md border border-border bg-white pl-6 pr-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
            />
          </div>
        </RowField>

        {/* Config-flag button — pushed to the right edge of the field
            row so it sits opposite the fields. Amber before the buyer
            has flagged, green with a Check after so the after-state is
            unambiguous. Only mounts when the item is at/below min OR
            has already been flagged (see `showConfigFlagHint`). */}
        {showConfigFlagHint && (
          <div className="ml-auto flex flex-col justify-end">
            <button
              type="button"
              onClick={onFlagConfig}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border px-2.5 text-[11.5px] transition-colors"
              style={
                isFlagged
                  ? {
                      color: "#166534",
                      backgroundColor: "#F0FDF4",
                      borderColor: "#BBF7D0",
                      fontWeight: 600,
                    }
                  : {
                      color: "#B45309",
                      backgroundColor: "rgba(254, 243, 199, 0.5)",
                      borderColor: "#FDE68A",
                      fontWeight: 600,
                    }
              }
              title={
                isFlagged
                  ? "Configuration issue filed for this item — click to file another"
                  : "Something off with this item? File a configuration issue"
              }
            >
              {isFlagged ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Flag filed</span>
                </>
              ) : (
                <>
                  <Wrench className="w-3 h-3" />
                  <span>Flag issue</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   StockChip — stock context with clear tone shifts:
     · below min → destructive tint
     · at min    → amber
     · above min → emerald
   Fonts are bumped from the muted 11px context line so the number
   is the first thing a scanning buyer sees.
   ═══════════════════════════════════════════════════════════════ */

function StockChip({ current, min }: { current: number; min: number }) {
  let bg = "#F0FDF4";
  let border = "#BBF7D0";
  let fg = "#166534";
  let label = "In stock";
  if (current < min) {
    bg = "#FEF2F2";
    border = "#FECACA";
    fg = "#B91C1C";
    label = "Below min";
  } else if (current === min) {
    bg = "#FFFBEB";
    border = "#FDE68A";
    fg = "#92400E";
    label = "At min";
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5"
      style={{
        fontSize: 11,
        fontFamily: FONT,
        color: fg,
        backgroundColor: bg,
        borderColor: border,
        fontWeight: 500,
      }}
    >
      <span
        className="tabular-nums"
        style={{ fontWeight: 700, fontSize: 12 }}
      >
        {current.toLocaleString()}
      </span>
      <span style={{ opacity: 0.7 }}>
        / min {min.toLocaleString()}
      </span>
      <span
        style={{
          opacity: 0.85,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        · {label}
      </span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMALL BUILDING BLOCKS
   ═══════════════════════════════════════════════════════════════ */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-slate-400"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontFamily: FONT,
      }}
    >
      {children}
    </p>
  );
}

function CompactField({
  label,
  required,
  optional,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          className="text-slate-600 leading-none"
          style={{ fontSize: 11.5, fontWeight: 600, fontFamily: FONT }}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {optional && (
            <span
              className="ml-1.5 text-slate-400"
              style={{ fontSize: 10, fontWeight: 500 }}
            >
              Optional
            </span>
          )}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={emphasis ? "text-slate-600" : "text-slate-500"}
        style={{
          fontSize: emphasis ? 12 : 11.5,
          fontWeight: emphasis ? 600 : 500,
          fontFamily: FONT,
        }}
      >
        {label}
      </span>
      <span
        className="text-foreground tabular-nums"
        style={{
          fontSize: emphasis ? 14 : 12,
          fontWeight: emphasis ? 700 : 600,
          fontFamily: FONT,
          letterSpacing: emphasis ? "-0.005em" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RowField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[10.5px] text-slate-500 mb-1"
        style={{ fontWeight: 500 }}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[10.5px] text-red-500 mt-1 leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}
