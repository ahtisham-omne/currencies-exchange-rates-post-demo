/* ═══════════════════════════════════════════════════════════════
   ConfigFlagModal — side-flow to file a configuration issue
   ───────────────────────────────────────────────────────────────
   Ports the wizard's ConfigFlagBlock (`PurchaseRequestForm.tsx`) into
   a small standalone Dialog that opens ON TOP of the review modal.
   A floor worker who spots that an item's stock master looks wrong
   (min set too low, on-hand count doesn't match the shelf, wrong
   vendor on file…) taps the subtle amber "Something off?" link on
   that row and lands here. Submitting creates a config-flag PR record
   instead of a purchase request, mirroring the wizard's inConfigMode
   handleSubmit branch.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from "react";
import { Wrench, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FONT } from "./designTokens";
import { CATALOG, getVendorSuggestions, type CatalogItem } from "./catalogData";
import { addPR, type PRConfigFlag, type PRLineItem } from "./prData";

type ConfigTarget = PRConfigFlag["target"];

interface ConfigFlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  onSuccess?: (prId: string) => void;
}

const CONFIG_OPTIONS: {
  key: PRConfigFlag["target"];
  label: string;
  currentFrom: (i?: CatalogItem) => string;
}[] = [
  {
    key: "min-stock",
    label: "Minimum stock level",
    currentFrom: (i) => (i ? `${i.minQuantity} ${i.defaultUOM}` : "—"),
  },
  {
    key: "max-stock",
    label: "Maximum stock level",
    currentFrom: (i) => (i ? `${i.minQuantity * 5} ${i.defaultUOM}` : "—"),
  },
  {
    key: "on-hand",
    label: "On-hand count",
    currentFrom: (i) => (i ? `${i.currentStock} ${i.defaultUOM}` : "—"),
  },
  {
    key: "vendor-info",
    label: "Vendor information",
    currentFrom: (i) => i?.partnerLocation || "—",
  },
  { key: "other", label: "Other", currentFrom: () => "—" },
];

export default function ConfigFlagModal({
  open,
  onOpenChange,
  itemId,
  onSuccess,
}: ConfigFlagModalProps) {
  const item = useMemo(
    () => (itemId ? CATALOG.find((c) => c.id === itemId) : undefined),
    [itemId],
  );
  /* Full vendor list from the catalogue — powers the Vendor
     information dropdown so buyers pick a known vendor instead of
     typing a free-text name. Memoised because getVendorSuggestions
     rebuilds the aggregated list on every call. */
  const vendorOptions = useMemo(() => getVendorSuggestions(), []);

  /* Multi-select — every selected target files its own PR-scoped
     config-flag (one row per target), so a buyer can spot several
     data-quality issues on the same item in a single pass. */
  const [selected, setSelected] = useState<Set<ConfigTarget>>(new Set());
  const [correctValues, setCorrectValues] = useState<Record<string, string>>({});
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  /* Reset on open so a subsequent flag for another item starts clean. */
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setCorrectValues({});
    setExplanation("");
    setSubmitting(false);
    setTriedSubmit(false);
  }, [open, itemId]);

  const toggleTarget = (key: ConfigTarget) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const currentDisplayFor = (key: ConfigTarget) =>
    CONFIG_OPTIONS.find((o) => o.key === key)?.currentFrom(item) ?? "—";

  const missingCorrect = Array.from(selected).filter(
    (t) => !(correctValues[t] ?? "").trim(),
  );
  const nothingSelected = selected.size === 0;
  const explanationError = !explanation.trim();
  const canSubmit =
    !nothingSelected &&
    missingCorrect.length === 0 &&
    !explanationError &&
    Boolean(item);

  const handleSubmit = () => {
    setTriedSubmit(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      /* One PR per selected target so each issue is trackable
         independently. Config flags default to a "need by" one week
         out — they're data-quality reports, not purchases. */
      const oneWeekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const y = oneWeekOut.getFullYear();
      const m = String(oneWeekOut.getMonth() + 1).padStart(2, "0");
      const d = String(oneWeekOut.getDate()).padStart(2, "0");
      const needByISO = `${y}-${m}-${d}`;
      const trimmedExplanation = explanation.trim();

      const filed: { id: string }[] = [];
      Array.from(selected).forEach((target, idx) => {
        const line: PRLineItem = {
          id: `li-config-${Date.now()}-${idx}`,
          itemId: item?.id,
          isNewItem: false,
          quantity: 0,
          uom: item?.defaultUOM || "EA",
        };
        const record = addPR({
          lineItems: [line],
          needBy: needByISO,
          urgency: "standard",
          reason: `Configuration flag raised: ${trimmedExplanation}`,
          configFlag: {
            target,
            currentValue: currentDisplayFor(target),
            correctValue: (correctValues[target] ?? "").trim(),
            explanation: trimmedExplanation,
          },
          attachments: [],
        });
        filed.push({ id: record.id });
      });

      toast.success(
        filed.length === 1
          ? "Configuration issue filed"
          : `${filed.length} configuration issues filed`,
        {
          description:
            filed.length === 1
              ? `${filed[0].id} routed to the buyer for review`
              : `Routed to the buyer for review (${filed.map((f) => f.id).join(", ")})`,
          style: { fontFamily: FONT },
        },
      );
      onOpenChange(false);
      onSuccess?.(filed[0].id);
    }, 220);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden border-0 sm:border [&>button.absolute]:hidden !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] !max-w-[100%] sm:!max-w-[520px] !max-h-[100dvh] sm:!max-h-[min(90vh,720px)] rounded-none sm:!rounded-2xl"
        style={{
          backgroundColor: "hsl(var(--card))",
          fontFamily: FONT,
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.24), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Flag configuration issue</DialogTitle>
        <DialogDescription className="sr-only">
          File a data-quality report against this item's master record.
        </DialogDescription>

        {/* ═════════ HEADER ═════════ */}
        <div className="shrink-0 border-b border-[#EEF2F6] bg-white rounded-t-none sm:rounded-t-2xl">
          <div className="flex items-start gap-3 px-5 pt-4 pb-4">
            <div
              className="shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "rgba(254, 243, 199, 0.6)",
                border: "1px solid #FDE68A",
              }}
            >
              <Wrench className="w-4 h-4" style={{ color: "#B45309" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-foreground truncate leading-tight"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                }}
              >
                Flag configuration issue
              </h2>
              <p
                className="text-muted-foreground mt-0.5 truncate"
                style={{ fontSize: 12, fontWeight: 400 }}
              >
                {item ? (
                  <>
                    Something off with{" "}
                    <span
                      className="text-foreground"
                      style={{ fontWeight: 600 }}
                    >
                      {item.itemNumber}
                    </span>
                    ? Tell the buyer what needs fixing.
                  </>
                ) : (
                  "Report a data-quality issue with this item."
                )}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═════════ BODY ═════════ */}
        <div
          className="flex-1 overflow-y-auto p-5 flex flex-col gap-4"
          style={{ backgroundColor: "#FAFBFC" }}
        >
          {/* Amber informational strip (ports the wizard banner) */}
          <div
            className="rounded-lg border px-3 py-2 flex items-start gap-2"
            style={{
              borderColor: "#FDE68A",
              backgroundColor: "rgba(254, 243, 199, 0.5)",
            }}
          >
            <Wrench
              className="w-3.5 h-3.5 mt-0.5 shrink-0"
              style={{ color: "#B45309" }}
            />
            <p
              className="text-[11.5px] leading-snug"
              style={{ color: "#78350F", fontFamily: FONT }}
            >
              <span style={{ fontWeight: 600 }}>
                Flag a configuration issue.
              </span>{" "}
              This creates a separate request that routes to the buyer to
              fix the item master — your purchase request stays intact.
            </p>
          </div>

          {/* What issues are you flagging? — multi-select. Each
              ticked row expands inline to show its current value and
              a "What it should be" input, so a buyer can capture
              several data-quality issues on the same item in one
              pass. */}
          <div>
            <FieldLabel label="What issues are you flagging?" required />
            <p
              className="mt-0.5 text-[11.5px] text-slate-500"
              style={{ fontFamily: FONT }}
            >
              Tick every field that needs fixing — one PR is filed per issue.
            </p>
            <div
              className={`mt-2 rounded-lg border overflow-hidden ${
                triedSubmit && nothingSelected ? "border-red-400" : "border-border"
              }`}
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              {CONFIG_OPTIONS.map((o, idx) => {
                const isSelected = selected.has(o.key);
                const currentDisplay = currentDisplayFor(o.key);
                const correctVal = correctValues[o.key] ?? "";
                const rowInvalid =
                  triedSubmit && isSelected && !correctVal.trim();
                return (
                  <div
                    key={o.key}
                    className={`transition-colors ${
                      idx === 0 ? "" : "border-t border-border"
                    } ${isSelected ? "bg-[#FFFBEB]" : "bg-white hover:bg-slate-50"}`}
                  >
                    <label
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
                      onClick={(e) => {
                        /* Prevent double-toggle when the click bubbles
                           from the checkbox itself (Radix already
                           handles that path). */
                        if (
                          (e.target as HTMLElement).closest("[data-slot='checkbox']")
                        )
                          return;
                        toggleTarget(o.key);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTarget(o.key)}
                        className="size-[18px]"
                        aria-label={o.label}
                      />
                      <span
                        className="text-[13px] flex-1"
                        style={{
                          color: "hsl(var(--foreground))",
                          fontFamily: FONT,
                          fontWeight: isSelected ? 600 : 500,
                        }}
                      >
                        {o.label}
                      </span>
                      <span
                        className="text-[11.5px] text-slate-500 tabular-nums"
                        style={{ fontFamily: FONT }}
                      >
                        Currently:{" "}
                        <span
                          className="text-foreground"
                          style={{ fontWeight: 500 }}
                        >
                          {currentDisplay}
                        </span>
                      </span>
                    </label>
                    {isSelected && (
                      <div className="px-3 pb-3 pl-[46px]">
                        <FieldLabel label="What it should be" required />
                        {o.key === "vendor-info" ? (
                          /* Vendor-info row uses a searchable Select
                             seeded with the catalogue vendor pool —
                             no free-text so buyers can't fat-finger
                             a vendor name. */
                          <Select
                            value={correctVal}
                            onValueChange={(v) =>
                              setCorrectValues((prev) => ({
                                ...prev,
                                [o.key]: v,
                              }))
                            }
                          >
                            <SelectTrigger
                              className={`mt-1 h-9 w-full text-[13px] bg-white ${
                                rowInvalid
                                  ? "border-red-400 focus:ring-red-400/20"
                                  : ""
                              }`}
                              style={{ fontFamily: FONT }}
                            >
                              <SelectValue placeholder="Pick the correct vendor…" />
                            </SelectTrigger>
                            <SelectContent
                              className="max-h-[280px]"
                              style={{ fontFamily: FONT }}
                            >
                              {vendorOptions.map((v) => (
                                <SelectItem
                                  key={v.name}
                                  value={v.name}
                                  className="text-[13px]"
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="inline-flex items-center justify-center h-5 min-w-[24px] px-1 rounded-md text-[10px] shrink-0"
                                      style={{
                                        backgroundColor: "hsl(var(--secondary))",
                                        color: "hsl(var(--muted-foreground))",
                                        fontWeight: 700,
                                        letterSpacing: "0.02em",
                                      }}
                                    >
                                      {v.abbr}
                                    </span>
                                    <span>{v.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <input
                            type="text"
                            value={correctVal}
                            onChange={(e) =>
                              setCorrectValues((prev) => ({
                                ...prev,
                                [o.key]: e.target.value,
                              }))
                            }
                            placeholder="Enter the correct value…"
                            className={`mt-1 w-full rounded-lg bg-white px-3 h-9 text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none border ${
                              rowInvalid
                                ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/20"
                                : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                            }`}
                            style={{ fontFamily: FONT }}
                            autoFocus
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {triedSubmit && nothingSelected && (
              <p
                className="mt-1.5 text-[11.5px] text-red-500"
                style={{ fontFamily: FONT }}
              >
                Pick at least one issue to flag.
              </p>
            )}
          </div>

          {/* Explanation — shared across every flagged issue so the
              buyer sees one context note per PR. */}
          <div>
            <FieldLabel label="Explanation" required />
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why are these configurations incorrect? What have you observed on the floor…"
              rows={4}
              className={`mt-1 w-full rounded-lg bg-white px-3 py-2 text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none border resize-y ${
                triedSubmit && explanationError
                  ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/20"
                  : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
              }`}
              style={{ fontFamily: FONT }}
            />
          </div>
        </div>

        {/* ═════════ FOOTER ═════════ */}
        <div
          className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 bg-white border-t"
          style={{ borderColor: "#EEF2F6" }}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg h-9 px-4 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-1.5 rounded-lg h-9 px-4 text-[13px] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#B45309",
              color: "white",
            }}
          >
            <Wrench className="w-3.5 h-3.5" />
            {submitting
              ? "Filing…"
              : selected.size > 1
                ? `File ${selected.size} configuration flags`
                : "File configuration flag"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <label
      className="text-[12px] text-foreground"
      style={{ fontWeight: 500, fontFamily: FONT }}
    >
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
