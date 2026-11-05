/**
 * ChangeCategoryReconcileModal — the reconciliation step that fires when an
 * existing item's PRIMARY CATEGORY changes in Edit Item, BEFORE the user leaves
 * the Category screen.
 *
 * Two steps:
 *   1. Decide  — states the implication and asks the one question: update the
 *                item to the new category's configuration defaults, or keep its
 *                current configuration? "Keep current configuration" proceeds
 *                immediately (category-only); it does NOT open review.
 *   2. Review  — shown only for "Update defaults". The category change sits in its
 *                own block, separate from a Configurations TABLE that lists every
 *                configuration with its disposition: what it changes to, "No
 *                change", or "No change due to transactions".
 *
 * Governing rule: the category change ALWAYS succeeds.
 *
 * Rendered as a custom portal at z-[400] so it stacks above the Create/Edit
 * modal (a Dialog with custom overlays up to z-[300]).
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ShieldCheck, AlertTriangle, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ConfigRow, ReconcileFieldKey, ReconcileStatus } from "./categoryReconcile";
import { OverflowTooltip, type OverflowItem } from "../items-v3/OverflowTooltip";

/** A single configuration line in the review. ConfigRow satisfies this too. */
export interface ReviewRow {
  key: string;
  label: string;
  currentDisplay: string;
  newDisplay: string;
  status: ReconcileStatus;
  /** Optional rich cell for the "New" column (tags, avatars, etc.). When present
   *  it renders instead of `newDisplay` (which stays as the text fallback). */
  newNode?: React.ReactNode;
  /** Optional multi-value list for the "New" column. Rendered as the first value
   *  plus a "+N" overflow chip whose hover popover lists the rest (matches the
   *  Items listing overflow cells). Takes precedence over newNode / newDisplay. */
  newItems?: string[];
  /** Optional list of people (names) for the "New" column. Like newItems but each
   *  entry renders with an initials avatar; the hover popover lists the rest as
   *  avatar rows (used for Ownership, Approvers). */
  newPeople?: string[];
}

/** A named group of configuration rows (e.g. Procurement, Governance). When
 *  the modal is given `sections`, the review renders them grouped under their
 *  section headers instead of the flat four-row table. */
export interface ReviewSection {
  id: string;
  label: string;
  /** Hex accent for the section marker dot. */
  color: string;
  rows: ReviewRow[];
}

interface Props {
  open: boolean;
  /** Current (previous) primary category, already rendered as a code. */
  oldCategoryCode: string;
  /** Destination primary category, already rendered as a code. */
  newCategoryCode: string;
  /** Single has-any-transaction gate result (drives the restriction note). */
  hasTransactions: boolean;
  /** All four configurations, annotated with tier + status. */
  rows: ConfigRow[];
  /** Optional grouped view: the full configuration taxonomy across every
   *  section. When present it drives the review table and the push/held tally. */
  sections?: ReviewSection[];
  onConfirm: (applied: { key: ReconcileFieldKey; newValue: string | boolean }[]) => void;
  onCancel: () => void;
}

type Step = "decide" | "review";

export function ChangeCategoryReconcileModal({
  open,
  oldCategoryCode,
  newCategoryCode,
  hasTransactions,
  rows,
  sections,
  onConfirm,
  onCancel,
}: Props) {
  const [step, setStep] = useState<Step>("decide");

  // Always (re)open on the decision step.
  useEffect(() => {
    if (open) setStep("decide");
  }, [open]);

  // Escape cancels (category change abandoned; user stays on the Category screen).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  // When grouped sections are supplied (the full worst-case taxonomy), they
  // drive the review and the push/held tallies; otherwise the flat `rows` do.
  const flatRows: ReviewRow[] = sections ? sections.flatMap((s) => s.rows) : rows;
  const heldRows = flatRows.filter((r) => r.status === "held");
  const pushedRows = flatRows.filter((r) => r.status === "pushed");

  const confirmPush = () =>
    onConfirm(
      pushedRows.map((r) => ({
        key: r.key as ReconcileFieldKey,
        newValue: (r as ConfigRow).newValue ?? r.newDisplay,
      })),
    );
  const keepCurrent = () => onConfirm([]); // proceed, category-only, no review

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Change primary category to ${newCategoryCode}`}
        className={cn(
          "w-full max-h-[88vh] flex flex-col bg-white rounded-2xl border border-slate-100 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.30)] overflow-hidden animate-in zoom-in-95 duration-150",
          step === "decide" ? "max-w-[440px]" : "max-w-[540px]",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {step === "decide" ? (
          <>
            {/* Alert-style header — matches the system confirm dialogs. */}
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#3B82F6" }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
                <Tag className="w-8 h-8" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Change primary category
              </span>
            </div>

            <div className="flex flex-col items-center text-center px-8 pb-7">
              <h2 className="text-[18px] tracking-[-0.02em] text-slate-900" style={{ fontWeight: 600 }}>
                Change primary category to {newCategoryCode}?
              </h2>
              <p className="text-[13px] mt-2 max-w-[340px] text-slate-500" style={{ lineHeight: 1.65 }}>
                Updating this item's primary category from <span className="text-slate-700" style={{ fontWeight: 600 }}>{oldCategoryCode}</span> to{" "}
                <span className="text-slate-700" style={{ fontWeight: 600 }}>{newCategoryCode}</span>. It brings its own default configurations. Update this item to use them?
              </p>

              {hasTransactions && heldRows.length > 0 && (
                <div className="mt-4 w-full rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-left">
                  <p className="text-[12px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-px shrink-0" />
                    <span>
                      This item has transactions, so these stay unchanged even if you update defaults:{" "}
                      <span style={{ fontWeight: 600 }}>{heldRows.map((r) => r.label).join(", ")}</span>.
                    </span>
                  </p>
                </div>
              )}

              <p className="mt-3 text-[11.5px] text-slate-400 flex items-start justify-center gap-1.5 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Past and in-progress transactions stay under their previous category.
              </p>

              <div className="w-full mt-6 flex flex-col gap-2.5">
                <Button onClick={() => setStep("review")} className="w-full h-11 text-[14px] rounded-xl" style={{ fontWeight: 600 }}>
                  Update defaults
                </Button>
                <Button variant="outline" onClick={keepCurrent} className="w-full h-11 text-[14px] rounded-xl" style={{ fontWeight: 500 }}>
                  Keep current configuration
                </Button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-9 text-[13px] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <h2 className="text-[15px] text-slate-800" style={{ fontWeight: 700 }}>
                Review changes
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
                Confirm the primary category change and how this item's configurations will update.
              </p>
            </div>

            {/* Category — fixed above the scroll region so it never scrolls away. */}
            <div className="px-5 pt-4 shrink-0">
              <p className="text-[10.5px] uppercase tracking-wide text-slate-400 mb-1.5" style={{ fontWeight: 700 }}>
                Primary category
              </p>
              <div className="rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2.5 flex items-center gap-2.5">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[13px] text-slate-500">{oldCategoryCode}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-[13px] text-slate-800" style={{ fontWeight: 700 }}>{newCategoryCode}</span>
              </div>
            </div>

            {/* Configurations heading — also fixed; only the rows below scroll. */}
            <div className="px-5 pt-3.5 shrink-0">
              <p className="text-[10.5px] uppercase tracking-wide text-slate-400 mb-1.5" style={{ fontWeight: 700 }}>
                Configurations
              </p>
            </div>

            {/* Only the configuration rows scroll; the table's column header is
                sticky so it stays pinned at the top of this scroll region. */}
            <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">
              {sections ? (
                  <div className="rounded-lg border border-slate-200">
                    {/* Column header stays pinned while the rows scroll under it.
                        (No overflow-hidden here — it would trap position:sticky.) */}
                    <div className="grid grid-cols-[150px_1fr_1fr] bg-slate-50 border-b border-slate-200 sticky top-0 z-10 rounded-t-lg">
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Configuration</div>
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Current</div>
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>New</div>
                    </div>
                    {sections.map((sec) => (
                      <React.Fragment key={sec.id}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50/70 border-t border-slate-100">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                          <span className="text-[10px] uppercase text-slate-500" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{sec.label}</span>
                        </div>
                        {sec.rows.map((r) => (
                          <div key={r.key} className="grid grid-cols-[150px_1fr_1fr] border-t border-slate-100 items-start">
                            <div className="px-3 py-2 pl-5 text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 600 }}>{r.label}</div>
                            <div className="px-3 py-2 text-[12px] text-slate-500 min-w-0"><span className="truncate block" title={r.currentDisplay}>{r.currentDisplay}</span></div>
                            <div className="px-3 py-2 min-w-0">{renderNewValue(r)}</div>
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[120px_1fr_1fr] bg-slate-50 border-b border-slate-200">
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Configuration</div>
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Current</div>
                      <div className="px-3 py-2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>New</div>
                    </div>
                    {rows.map((r) => (
                      <div key={r.key} className="grid grid-cols-[120px_1fr_1fr] border-t border-slate-100 first:border-t-0 items-center">
                        <div className="px-3 py-2.5 text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{r.label}</div>
                        <div className="px-3 py-2.5 text-[12px] text-slate-500 truncate" title={r.currentDisplay}>{r.currentDisplay}</div>
                        <div className="px-3 py-2.5">{renderNewValue(r)}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2 shrink-0">
              <Button variant="ghost" onClick={() => setStep("decide")} className="h-9 text-slate-600 hover:text-slate-800 mr-auto">
                Back
              </Button>
              <Button variant="ghost" onClick={onCancel} className="h-9 text-slate-500 hover:text-slate-700">
                Cancel
              </Button>
              <Button onClick={confirmPush} className="h-9 gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Confirm
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** First value as an emerald "new" chip + a "+N" overflow chip whose hover popover
 *  lists the remaining values. Mirrors the Items listing overflow cells so long
 *  lists (locations, alternative units, specific partners) stay compact. */
function OverflowChips({ items, category }: { items: string[]; category: string }) {
  if (!items || items.length === 0) return null;
  const chipCls =
    "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] leading-none text-emerald-700 whitespace-nowrap";
  const first = items[0];
  const overflow = items.length - 1;
  if (overflow <= 0) {
    return <span className={chipCls} style={{ fontWeight: 600 }}>{first}</span>;
  }
  const rest: OverflowItem[] = items.slice(1).map((v, i) => ({ id: `${i}-${v}`, name: v, subtitle: "" }));
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={chipCls} style={{ fontWeight: 600 }}>{first}</span>
      <OverflowTooltip items={rest} category={category} variant="pills" zClass="z-[500]">
        <span className={cn(chipCls, "cursor-default")} style={{ fontWeight: 700 }}>+{overflow}</span>
      </OverflowTooltip>
    </div>
  );
}

const PEOPLE_COLORS = ["#2563EB", "#7C3AED", "#059669", "#DB2777", "#D97706", "#0891B2"];
const personInitials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** People variant of OverflowChips: first person (initials avatar + name) + a "+N"
 *  whose hover popover lists the rest as avatar rows. Used for Ownership and
 *  Approvers so long member lists stay compact. */
function OverflowPeople({ names, category }: { names: string[]; category: string }) {
  if (!names || names.length === 0) return null;
  const chipCls =
    "inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 pl-1 pr-1.5 py-0.5 text-[11px] leading-none text-emerald-700 whitespace-nowrap";
  const avatar = (name: string, i: number) => (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] shrink-0"
      style={{ backgroundColor: PEOPLE_COLORS[i % PEOPLE_COLORS.length], fontWeight: 700 }}
    >
      {personInitials(name)}
    </span>
  );
  const first = names[0];
  const overflow = names.length - 1;
  if (overflow <= 0) {
    return <span className={chipCls} style={{ fontWeight: 600 }}>{avatar(first, 0)}{first}</span>;
  }
  const rest: OverflowItem[] = names.slice(1).map((n, i) => ({
    id: `${i}-${n}`,
    name: n,
    subtitle: "",
    initials: personInitials(n),
    avatarBg: PEOPLE_COLORS[(i + 1) % PEOPLE_COLORS.length],
    avatarFg: "#FFFFFF",
  }));
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={chipCls} style={{ fontWeight: 600 }}>{avatar(first, 0)}{first}</span>
      <OverflowTooltip items={rest} category={category} variant="rows" zClass="z-[500]">
        <span className={cn(chipCls, "cursor-default")} style={{ fontWeight: 700 }}>+{overflow}</span>
      </OverflowTooltip>
    </div>
  );
}

/** The "New" column cell, by row status (the "Current" value is its own column). */
function renderNewValue(r: ReviewRow) {
  if (r.status === "pushed") {
    if (r.newPeople && r.newPeople.length) return <div className="min-w-0"><OverflowPeople names={r.newPeople} category={r.label} /></div>;
    if (r.newItems && r.newItems.length) return <div className="min-w-0"><OverflowChips items={r.newItems} category={r.label} /></div>;
    if (r.newNode) return <div className="min-w-0">{r.newNode}</div>;
    return (
      <span className="text-[12px] text-emerald-700 truncate block" style={{ fontWeight: 700 }} title={r.newDisplay}>
        {r.newDisplay}
      </span>
    );
  }
  if (r.status === "held") {
    return (
      <span className="text-[11px] text-amber-600 flex items-center gap-1 leading-snug">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        No change due to transactions
      </span>
    );
  }
  // unchanged — same in both configurations
  return <span className="text-[11px] text-slate-400">No change</span>;
}
