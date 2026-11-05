/* ═══════════════════════════════════════════════════════════════
   NewItemRequestModal — single-surface "new item (not on file)"
   ───────────────────────────────────────────────────────────────
   Replaces the wizard's Step-1→2→3 for the new-item path. Same shell
   as PurchaseRequestReviewModal so the two request flows read as
   siblings: left panel captures the items the buyer wants to add
   (name, notes, ref link, qty/uom/price), right panel is the shared
   request-details sidebar. One submit for everything.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Info,
  Minus,
  Package,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import MultiplePRsCreatedModal, {
  type CreatedPRSummary,
} from "./MultiplePRsCreatedModal";
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
import { FONT } from "./designTokens";
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

interface NewItemDraft {
  id: string;
  name: string;
  referenceLink: string;
  preferredVendor: string;
  quantity: string;
  uom: string;
  estimatedPrice: string;
}

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

const EMPTY_FORM: Omit<NewItemDraft, "id"> = {
  name: "",
  referenceLink: "",
  preferredVendor: "",
  quantity: "1",
  uom: "EA",
  estimatedPrice: "",
};

interface NewItemRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (prId: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

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

export default function NewItemRequestModal({
  open,
  onOpenChange,
  onSuccess,
}: NewItemRequestModalProps) {
  const [drafts, setDrafts] = useState<NewItemDraft[]>([]);
  const [checkedDraftIds, setCheckedDraftIds] = useState<Set<string>>(
    new Set(),
  );
  const [form, setForm] = useState<Omit<NewItemDraft, "id">>(EMPTY_FORM);
  /* Extras toggles — kept as independent switches so the "Add vendor"
     and "Add link" footer buttons each reveal only their own field. */
  const [showVendorField, setShowVendorField] = useState(false);
  const [showReferenceField, setShowReferenceField] = useState(false);

  /* Shared request meta */
  const [needBy, setNeedBy] = useState("");
  const [urgency, setUrgency] = useState<PRUrgency>("standard");
  const [reason, setReason] = useState("");
  const [referenceDoc, setReferenceDoc] = useState("");
  const [attachments, setAttachments] = useState<PRAttachment[]>([]);
  const [needByOpen, setNeedByOpen] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [multiCreated, setMultiCreated] = useState<CreatedPRSummary[] | null>(
    null,
  );

  /* Reset on open */
  useEffect(() => {
    if (!open) return;
    setDrafts([]);
    setCheckedDraftIds(new Set());
    setForm(EMPTY_FORM);
    setShowVendorField(false);
    setShowReferenceField(false);
    setNeedBy("");
    setUrgency("standard");
    setReason("");
    setReferenceDoc("");
    setAttachments([]);
    setTriedSubmit(false);
    setSubmitting(false);
  }, [open]);

  const suggestedUrgency = useMemo(
    () =>
      suggestUrgency({
        needByISO: needBy || undefined,
      }),
    [needBy],
  );

  const checkedDrafts = useMemo(
    () => drafts.filter((d) => checkedDraftIds.has(d.id)),
    [drafts, checkedDraftIds],
  );

  const totalQty = useMemo(
    () =>
      checkedDrafts.reduce(
        (sum, d) => sum + (parseFloat(d.quantity) || 0),
        0,
      ),
    [checkedDrafts],
  );
  const estimatedTotal = useMemo(
    () =>
      checkedDrafts.reduce((sum, d) => {
        const qty = parseFloat(d.quantity) || 0;
        const price = parseFloat(d.estimatedPrice) || 0;
        return sum + qty * price;
      }, 0),
    [checkedDrafts],
  );

  const commitForm = () => {
    if (!form.name.trim()) return;
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const draft: NewItemDraft = {
      id,
      name: form.name.trim(),
      referenceLink: form.referenceLink.trim(),
      preferredVendor: form.preferredVendor.trim(),
      quantity: form.quantity || "1",
      uom: form.uom || "EA",
      estimatedPrice: form.estimatedPrice.trim(),
    };
    setDrafts((prev) => [...prev, draft]);
    setCheckedDraftIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setForm(EMPTY_FORM);
    setShowVendorField(false);
    setShowReferenceField(false);
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setCheckedDraftIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleDraftCheck = (id: string) =>
    setCheckedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const patchDraft = (id: string, patch: Partial<NewItemDraft>) =>
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );

  const attach = (file: File) =>
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        filename: file.name,
        sizeKb: Math.round(file.size / 1024),
      },
    ]);

  /* Validation */
  const draftErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const d of checkedDrafts) {
      const qty = parseFloat(d.quantity);
      if (!qty || qty <= 0) errs[d.id] = "Quantity is required";
    }
    return errs;
  }, [checkedDrafts]);

  const noDrafts = drafts.length === 0;
  const nothingChecked = !noDrafts && checkedDrafts.length === 0;
  const reasonError = reason.trim().length === 0;
  const canSubmit =
    !noDrafts &&
    !nothingChecked &&
    Object.keys(draftErrors).length === 0 &&
    !reasonError;

  const handleSubmit = () => {
    setTriedSubmit(true);
    if (!canSubmit) {
      toast.error(
        noDrafts
          ? "Add at least one item to submit"
          : nothingChecked
            ? "Select at least one item"
            : "Fix the highlighted fields before submitting",
        { style: { fontFamily: FONT } },
      );
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      /* Enforce "single vendor per PR" — group checked drafts by
         preferredVendor and submit one addPR per group. Drafts with
         no preferredVendor share a "No vendor" bucket. */
      const byVendor = new Map<
        string,
        typeof checkedDrafts
      >();
      for (const d of checkedDrafts) {
        const key = (d.preferredVendor || "").trim() || "No vendor";
        const bucket = byVendor.get(key);
        if (bucket) bucket.push(d);
        else byVendor.set(key, [d]);
      }
      const groups = Array.from(byVendor.entries());
      const createdSummaries: CreatedPRSummary[] = [];
      let firstId = "";
      groups.forEach(([vendor, groupDrafts], groupIdx) => {
        const lineItems: PRLineItem[] = groupDrafts.map((d, idx) => ({
          id: `li-new-${d.id}-${idx}`,
          isNewItem: true,
          newItemName: d.name,
          referenceLinkOrFile: d.referenceLink || undefined,
          preferredVendor: d.preferredVendor || undefined,
          quantity: parseFloat(d.quantity) || 0,
          uom: d.uom || "EA",
          estimatedUnitPrice: d.estimatedPrice
            ? parseFloat(d.estimatedPrice)
            : undefined,
        }));
        const record = addPR({
          lineItems,
          needBy,
          urgency,
          reason: reason.trim(),
          referenceDoc: referenceDoc.trim() || undefined,
          attachments,
        });
        if (groupIdx === 0) firstId = record.id;
        const total = groupDrafts.reduce((sum, d) => {
          const qty = parseFloat(d.quantity) || 0;
          const price = parseFloat(d.estimatedPrice) || 0;
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
        <DialogTitle className="sr-only">
          New Item Request
        </DialogTitle>
        <DialogDescription className="sr-only">
          Describe items that are not in the catalog yet.
        </DialogDescription>

        {/* ═════════ HEADER ═════════ */}
        <div className="shrink-0 z-10 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-3.5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                  title="Close"
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
                  <Plus
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
                    New Item Request
                  </h2>
                  <p className="!text-[11px] sm:!text-xs !text-slate-500 mt-0.5 truncate !font-normal">
                    {drafts.length > 0
                      ? `${checkedDrafts.length} of ${drafts.length} item${drafts.length !== 1 ? "s" : ""} selected`
                      : "Describe items that are not in the catalog yet."}
                  </p>
                </div>
              </div>

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

        {/* ═════════ BODY ═════════ */}
        <div
          className="flex-1 flex flex-col min-w-0 min-h-0"
          style={{ backgroundColor: "#FAFBFC" }}
        >
          <div
            className="flex-1 overflow-y-auto"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "hsl(var(--border)) transparent",
            }}
          >
            <div className="px-5 py-5">
              <div className="flex flex-col lg:flex-row gap-5">
                {/* ── LEFT: draft list + add form ── */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  {/* Committed drafts */}
                  {drafts.length > 0 && (
                    <div className="rounded-[var(--radius-lg)] border border-border overflow-hidden bg-card">
                      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-border">
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-lg"
                          style={{
                            width: "32px",
                            height: "32px",
                            backgroundColor: "hsl(var(--accent))",
                          }}
                        >
                          <Package className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] text-foreground truncate"
                            style={{ fontWeight: 600 }}
                          >
                            Items I need
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {drafts.length} item{drafts.length !== 1 ? "s" : ""}{" "}
                            described so far
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0 px-3 pt-2 pb-3">
                        {drafts.map((d) => (
                          <DraftRow
                            key={d.id}
                            draft={d}
                            isChecked={checkedDraftIds.has(d.id)}
                            onToggleCheck={() => toggleDraftCheck(d.id)}
                            onPatch={(p) => patchDraft(d.id, p)}
                            onRemove={() => removeDraft(d.id)}
                            hasError={
                              triedSubmit &&
                              checkedDraftIds.has(d.id) &&
                              Boolean(draftErrors[d.id])
                            }
                            errorMessage={draftErrors[d.id]}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline add form */}
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60">
                      <p
                        className="text-[13px] text-foreground"
                        style={{ fontWeight: 600 }}
                      >
                        {drafts.length > 0
                          ? "Add another item"
                          : "Describe the new item"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {drafts.length > 0
                          ? "Any details help. The buyer takes it from there."
                          : "Start with a name and quantity. Add more item details if available."}
                      </p>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      {/* Item name */}
                      <CompactField label="Item name" required>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Hex bolts M6 · stainless steel · 20mm"
                          className="w-full h-9 rounded-md border border-border bg-white px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                          style={{ fontFamily: FONT }}
                        />
                      </CompactField>

                      {/* Qty + UOM + price row (same pattern as review) */}
                      <div className="flex items-end flex-wrap gap-x-4 gap-y-2">
                        <CompactField label="Quantity" required>
                          <div className="inline-flex items-stretch h-8 rounded-md border border-border bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  quantity: String(
                                    Math.max(
                                      0,
                                      (parseFloat(prev.quantity) || 0) - 1,
                                    ),
                                  ),
                                }))
                              }
                              disabled={
                                (parseFloat(form.quantity) || 0) <= 0
                              }
                              className="grid w-7 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={form.quantity}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  quantity: e.target.value,
                                }))
                              }
                              className="w-12 text-center text-[12px] bg-transparent focus:outline-none tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  quantity: String(
                                    (parseFloat(prev.quantity) || 0) + 1,
                                  ),
                                }))
                              }
                              className="grid w-7 place-items-center text-slate-500 hover:bg-slate-50"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span
                              aria-hidden
                              className="w-px h-full bg-border shrink-0"
                            />
                            <div className="relative shrink-0">
                              <select
                                value={form.uom}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    uom: e.target.value,
                                  }))
                                }
                                aria-label="Unit of measure"
                                className="h-full pl-2 pr-5 text-[11.5px] appearance-none bg-transparent text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                              >
                                {UOM_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            </div>
                          </div>
                        </CompactField>

                        <CompactField label="Est. unit price" optional>
                          <div className="relative w-[110px]">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">
                              $
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={form.estimatedPrice}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  estimatedPrice: e.target.value,
                                }))
                              }
                              placeholder="0.00"
                              className="w-full h-8 rounded-md border border-border bg-white pl-6 pr-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                            />
                          </div>
                        </CompactField>
                      </div>

                      {/* Preferred vendor — surfaced by the footer's
                          "Add vendor" chip. Distinct from the free-text
                          notes below because it flows into the PR line
                          item's `preferredVendor` field. */}
                      {showVendorField && (
                        <CompactField
                          label="Preferred vendor"
                          optional
                          trailing={
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  preferredVendor: "",
                                }));
                                setShowVendorField(false);
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] text-slate-400 hover:text-slate-600 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <X className="w-2.5 h-2.5" />
                              Remove
                            </button>
                          }
                        >
                          <input
                            type="text"
                            value={form.preferredVendor}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                preferredVendor: e.target.value,
                              }))
                            }
                            placeholder="e.g. Grainger, McMaster-Carr, current supplier..."
                            className="w-full h-9 rounded-md border border-border bg-white px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                            style={{ fontFamily: FONT }}
                            autoFocus
                          />
                        </CompactField>
                      )}

                      {/* Reference link — behind a toggle so the
                          primary form stays light. */}
                      {showReferenceField && (
                        <CompactField
                          label="Reference link"
                          optional
                          trailing={
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  referenceLink: "",
                                }));
                                setShowReferenceField(false);
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] text-slate-400 hover:text-slate-600 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <X className="w-2.5 h-2.5" />
                              Remove
                            </button>
                          }
                        >
                          <input
                            type="text"
                            value={form.referenceLink}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                referenceLink: e.target.value,
                              }))
                            }
                            placeholder="https://..."
                            className="w-full h-9 rounded-md border border-border bg-white px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                            style={{ fontFamily: FONT }}
                            autoFocus
                          />
                        </CompactField>
                      )}
                    </div>

                    {/* Form footer — white background, kept distinct
                        from the fields above by a slightly firmer top
                        border (slate-200 shows up as a real division
                        line rather than blending into the card). Left:
                        secondary toggles ("Add vendor", "Add notes").
                        Right: the primary "Add item" CTA. */}
                    <div
                      className="bg-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap"
                      style={{ borderTop: "1px solid #E2E8F0" }}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!showVendorField && (
                          <button
                            type="button"
                            onClick={() => setShowVendorField(true)}
                            className="inline-flex items-center gap-1 h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11.5px] text-foreground hover:border-primary/40 hover:text-primary transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3 h-3" />
                            Add vendor
                          </button>
                        )}
                        {!showReferenceField && (
                          <button
                            type="button"
                            onClick={() => setShowReferenceField(true)}
                            className="inline-flex items-center gap-1 h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11.5px] text-foreground hover:border-primary/40 hover:text-primary transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3 h-3" />
                            Add link
                          </button>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={commitForm}
                        disabled={!form.name.trim()}
                        className="gap-1.5 rounded-lg h-9 px-4 text-[12.5px] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add item
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: request details sidebar ── */}
                <div className="lg:w-[360px] xl:w-[400px] shrink-0">
                  <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden lg:sticky lg:top-4">
                    <div className="px-4 py-3 border-b border-border">
                      <p
                        className="text-[13.5px] text-foreground leading-tight"
                        style={{
                          fontWeight: 600,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        Request details
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        These apply to the whole request.
                      </p>
                    </div>

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
                                    const m = String(d.getMonth() + 1).padStart(
                                      2,
                                      "0",
                                    );
                                    const day = String(d.getDate()).padStart(
                                      2,
                                      "0",
                                    );
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
                            <span style={{ fontWeight: 600 }}>Add a file</span>
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

                    <div className="border-t border-border bg-[#FAFBFC] px-4 py-3.5 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <SummaryRow
                          label="Total units"
                          value={totalQty.toLocaleString()}
                        />
                        <SummaryRow
                          label="Estimated value"
                          value={`$${estimatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                          : `Submit request${checkedDrafts.length > 1 ? ` (${checkedDrafts.length})` : ""}`}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      {/* Multi-PR confirmation — mirrors the review modal's split
          behavior when the buyer's drafts span >1 preferred vendor. */}
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
   DRAFT ROW — one committed new-item entry, editable inline
   ═══════════════════════════════════════════════════════════════ */

function DraftRow({
  draft,
  isChecked,
  onToggleCheck,
  onPatch,
  onRemove,
  hasError,
  errorMessage,
}: {
  draft: NewItemDraft;
  isChecked: boolean;
  onToggleCheck: () => void;
  onPatch: (patch: Partial<NewItemDraft>) => void;
  onRemove: () => void;
  hasError: boolean;
  errorMessage?: string;
}) {
  const stepQty = (delta: number) => {
    const current = parseFloat(draft.quantity) || 0;
    onPatch({ quantity: String(Math.max(0, current + delta)) });
  };
  return (
    <div
      className={`rounded-xl border overflow-hidden mb-2 transition-all duration-150 ${
        hasError
          ? "border-red-300 bg-red-50/20"
          : isChecked
            ? "border-border bg-card hover:border-primary/20 hover:shadow-sm"
            : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="shrink-0 mt-1">
          <Checkbox
            checked={isChecked}
            onCheckedChange={onToggleCheck}
            className="size-[18px]"
            aria-label={isChecked ? "Deselect item" : "Select item"}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-foreground truncate text-[13.5px] leading-[20px]"
              style={{ fontWeight: 600 }}
            >
              {draft.name}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-0 rounded-md shrink-0 text-[10px] leading-[16px]"
              style={{
                fontWeight: 600,
                color: "hsl(var(--primary))",
                backgroundColor: "hsl(var(--accent))",
              }}
            >
              New item
            </span>
            {draft.preferredVendor && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0 rounded-md shrink-0 text-[10px] leading-[16px]"
                style={{
                  fontWeight: 600,
                  color: "#166534",
                  backgroundColor: "#F0FDF4",
                }}
                title={`Preferred vendor: ${draft.preferredVendor}`}
              >
                <Check className="w-2.5 h-2.5" />
                {draft.preferredVendor}
              </span>
            )}
          </div>
          {draft.referenceLink && (
            <p
              className="text-muted-foreground text-[11.5px] leading-[16px] mt-0.5 line-clamp-1"
              title={draft.referenceLink}
            >
              {draft.referenceLink}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 flex items-center justify-center"
          title="Remove"
          aria-label={`Remove ${draft.name}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-end flex-wrap gap-x-4 gap-y-2 px-3 py-2 border-t border-border bg-[#FAFBFC]">
        <CompactField
          label="Quantity"
          required
          {...(hasError && errorMessage
            ? { trailing: null }
            : {})}
        >
          <div className="inline-flex items-stretch h-8 rounded-md border border-border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => stepQty(-1)}
              disabled={(parseFloat(draft.quantity) || 0) <= 0}
              className="grid w-7 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={draft.quantity}
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
                value={draft.uom}
                onChange={(e) => onPatch({ uom: e.target.value })}
                aria-label="Unit of measure"
                className="h-full pl-2 pr-5 text-[11.5px] appearance-none bg-transparent text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
          </div>
        </CompactField>

        <CompactField label="Est. unit price" optional>
          <div className="relative w-[110px]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.estimatedPrice}
              onChange={(e) => onPatch({ estimatedPrice: e.target.value })}
              placeholder="0.00"
              className="w-full h-8 rounded-md border border-border bg-white pl-6 pr-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
            />
          </div>
        </CompactField>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR HELPERS (mirrors PurchaseRequestReviewModal). Kept in
   sync manually for now — extract into a shared file if a third
   surface adopts the same shape.
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
