import React, { useState } from "react";
import {
  Receipt,
  Building2,
  Check,
  Copy,
  Lock,
  Eye,
  Pencil,
  X,
  Clock,
  SquareSplitHorizontal,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/app/components/ui/tooltip";
import { toast } from "sonner";
import type { PaymentTermPreset } from "@/app/data/paymentTermPresets";

interface PaymentTermCardProps {
  term: PaymentTermPreset;
  isSelected?: boolean;
  /** When true, suppresses the floating checkmark badge even if
   *  isSelected. Useful for the General Info "current term" summary
   *  where the card already represents the active selection and the
   *  badge adds visual noise. */
  hideCheckmark?: boolean;
  /** Tighter padding + smaller hero number + reduced row gaps for the
   *  General Info summary slot where horizontal space is at a premium
   *  and the card should feel like a status chip, not a picker card. */
  compact?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  onApply?: (term: PaymentTermPreset) => void;
  onDuplicate?: (term: PaymentTermPreset) => void;
  onView?: (term: PaymentTermPreset) => void;
  /** Footer "See detail" slot (Eli 9/8): in the browse-and-select modal
   *  the card CLICK selects, so the detail view needs its own explicit
   *  affordance — a view action, not a commit. */
  onSeeDetail?: (term: PaymentTermPreset) => void;
  /** Upgrades the selected treatment to the partner group-selection
   *  identity (primary border + blue tint fill) for pickers where the
   *  click-to-select state must read unmistakably. Default keeps the
   *  subtle border for summary cards that are permanently selected. */
  selectedRing?: boolean;
  /** Renders the partner group-selection control inside the card header
   *  (user 10/1): an always-visible radio circle that fills with the
   *  primary check when selected, so the cards read as selectable
   *  before the first click. Replaces the floating corner badge. */
  selectControl?: boolean;
  readOnly?: boolean;
  searchText?: string;
  showPresetBadge?: boolean;
  /** Marks this term as inherited from the vendor's partner default —
   *  renders a tooltip'd "Inherited" pill next to the type pill, matching
   *  the Freight & Logistics CarrierCard. */
  isInherited?: boolean;
  /** Controlled split-slice selection (9/1/26): the invoice-creation
   *  sidebar uses the S-chips to pick WHICH slice this invoice covers.
   *  When onSliceSelect is provided the chips become the real picker
   *  (controlled by sliceIdx) and the strip gains an "Invoice covers"
   *  micro-label + helper line. Left unset, the chips stay a local
   *  browse-only toggle. */
  sliceIdx?: number;
  onSliceSelect?: (idx: number) => void;
  /** Kind rule (9/1/26, Mahreen): index-aligned lock reasons — a truthy
   *  entry disables that S-chip and explains itself in a tooltip. A
   *  pre-invoice can only cover the prepayment slices, a received-goods
   *  invoice only the non-prepayment ones. */
  sliceDisabledReasons?: (string | null)[];
  /** Helper under the selectable S-chips. Defaults to the vendor copy;
   *  Customer Invoicing passes its own (opt-in, vendor rendering unchanged). */
  splitNote?: string;
}

function highlightMatch(text: string, query?: string) {
  if (!query || !query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function parseSplits(desc: string): { pct: string; label: string }[] {
  const matches = desc.match(/(\d+)%/g);
  if (!matches || matches.length < 2) return [];
  return matches.map((s, i) => {
    const pct = s.replace("%", "");
    const parts = desc.split(s);
    const afterText = parts[1]?.split(/[,.]/).shift()?.trim().replace(/^(is )?due (at |on )?/, "").replace(/^at /, "").trim() || "";
    return { pct, label: afterText || `Event ${i + 1}` };
  });
}

function SplitTierDisplay({ term, sliceIdx, onSliceSelect, sliceDisabledReasons, splitNote }: { term: PaymentTermPreset; sliceIdx?: number; onSliceSelect?: (idx: number) => void; sliceDisabledReasons?: (string | null)[]; splitNote?: string }) {
  const splits = parseSplits(term.description);
  const isMulti = splits.length > 1;
  const [localIdx, setLocalIdx] = useState(0);
  // Controlled when the caller passes a selection handler (the invoice
  // sidebar's "which slice does this invoice cover" picker); local
  // browse-only toggle otherwise.
  const selectable = !!onSliceSelect;
  const activeIdx = selectable ? Math.min(sliceIdx ?? 0, splits.length - 1) : localIdx;
  const setActiveIdx = (i: number) => (selectable ? onSliceSelect(i) : setLocalIdx(i));
  const shown = splits[isMulti ? activeIdx : 0];
  const splitColor =
    term.category === "net" ? "#0A77FF"
    : term.category === "prepayment" ? "#6D28D9"
    : "#B45309";

  if (splits.length === 0) return null;

  return (
    <>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[22px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
          {splits.length}
        </span>
        <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
          {splits.length === 1 ? "split" : "splits"}
        </span>
      </div>

      <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Picker micro-label — only when the chips actually decide
            which slice the invoice covers. */}
        {selectable && isMulti && (
          <p className="text-[10px] text-slate-500 mb-1" style={{ fontWeight: 600 }}>
            Invoice Covers<span className="text-red-500">*</span>
          </p>
        )}
        <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
          {isMulti && splits.map((s, i) => {
            const isActive = activeIdx === i;
            const typeColor = splitColor;
            const lockReason = selectable ? sliceDisabledReasons?.[i] ?? null : null;
            const chip = (
              <button
                onClick={(e) => { e.stopPropagation(); if (!lockReason) setActiveIdx(i); }}
                aria-disabled={!!lockReason}
                className={`h-[22px] rounded-md text-[10px] transition-all duration-200 flex items-center justify-center gap-0.5 px-2 ${
                  lockReason
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-200/70"
                    : isActive
                      ? "shadow-sm cursor-pointer"
                      : "bg-muted text-slate-500 hover:bg-border cursor-pointer"
                }`}
                style={{
                  fontWeight: isActive && !lockReason ? 600 : 500,
                  ...(isActive && !lockReason ? { backgroundColor: `${typeColor}18`, color: typeColor, boxShadow: `0 0 0 1px ${typeColor}40` } : {}),
                }}
              >
                {lockReason && <Lock className="w-2.5 h-2.5" />}
                S{i + 1}
                {isActive && !lockReason && (
                  <span className="ml-0.5 text-[9px] opacity-60" style={{ fontWeight: 400 }}>
                    {s.pct}%
                  </span>
                )}
              </button>
            );
            // Every chip explains itself on hover (9/3/26 review):
            // locked chips keep their kind-rule reason; the rest say
            // what the slice covers and WHICH trigger starts its clock,
            // so S1 vs S2 vs S3 reads without clicking through them.
            return (
              <Tooltip key={i} delayDuration={200}>
                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[240px] leading-relaxed">
                  {lockReason ? (
                    <span className="block text-center">{lockReason}</span>
                  ) : (
                    <>
                      <p className="text-[11px]" style={{ fontWeight: 600 }}>{`S${i + 1} covers ${s.pct}% of the order`}</p>
                      <p className="text-[11px] opacity-80 leading-snug mt-0.5">
                        {`${s.label.charAt(0).toUpperCase()}${s.label.slice(1)}.`}
                      </p>
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {shown && (
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] min-w-0">
            <span className="text-slate-500 capitalize truncate" style={{ fontWeight: 400 }}>{shown.label}</span>
            <span className="shrink-0 ml-2 text-foreground" style={{ fontWeight: 600 }}>{shown.pct}%</span>
          </div>
        )}
        {selectable && isMulti && (
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            {splitNote ?? 'A different vendor invoice will be created for each split.'}
          </p>
        )}
      </div>
    </>
  );
}

export function PaymentTermCard({
  term,
  isSelected,
  hideCheckmark = false,
  compact = false,
  onRemove,
  onClick,
  onApply,
  onDuplicate,
  onView,
  onSeeDetail,
  selectedRing = false,
  selectControl = false,
  readOnly = false,
  searchText,
  showPresetBadge = false,
  isInherited = false,
  sliceIdx,
  onSliceSelect,
  sliceDisabledReasons,
  splitNote,
}: PaymentTermCardProps) {
  // Source the "in use" count directly from the preset record. The partner
  // module derives this from a VendorContext lookup; the vendor-invoicing
  // app doesn't ship that provider, so we read the pre-baked count instead.
  const inUseCount = term.vendorsApplied;
  const ptDays = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  // A prepayment term has no net-days window (Eli 9/24 R08): the card
  // shows its configured PERCENTAGE at the trigger, never a bogus
  // regex-fallback "30 days".
  const prepayPct = term.category === "prepayment"
    ? (term.description.match(/(\d+)\s*%/)?.[1] ?? "100")
    : null;
  const pill =
    term.category === "net"
      ? { text: "#0A77FF", bg: "#EFF6FF", border: "#DBEAFE" }
      : term.category === "prepayment"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  const isCustom = term.id.startsWith("pt-custom-");
  const showFooter = !readOnly && (onApply || onDuplicate || onSeeDetail);
  const footerCols = [onSeeDetail, onApply, onDuplicate].filter(Boolean).length;

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isSelected
          ? selectedRing
            ? "bg-[#F5F9FF] border-primary shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
            : "bg-white border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "bg-white border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {isSelected && !hideCheckmark && !selectControl && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {onRemove && !readOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-all z-10 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className={`${compact ? "p-2.5" : "p-3"} flex-1 flex flex-col min-h-0 overflow-hidden`}>
        <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1.5" : "mb-2"} shrink-0`}>
          <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
            >
              {term.category === "net" ? (
                <Receipt className="w-3 h-3" />
              ) : term.category === "prepayment" ? (
                <Clock className="w-3 h-3" />
              ) : (
                <SquareSplitHorizontal className="w-3 h-3" />
              )}
              {term.typeBadge}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l max-w-[220px]" style={{ fontWeight: 500, borderColor: pill.border }}>
              {(() => {
                if (term.category !== "split") return <span className="truncate">{term.trigger}</span>;
                const splits = parseSplits(term.description);
                if (splits.length === 0) return <span className="truncate">{term.trigger}</span>;
                const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
                const labels = splits.map((s) => titleCase(s.label));
                const inline = labels.length <= 2 ? labels : labels.slice(0, 2);
                const overflow = labels.length - inline.length;
                return (
                  <span className="truncate">
                    {inline.join(" · ")}
                    {overflow > 0 ? ` +${overflow}` : ""}
                  </span>
                );
              })()}
            </span>
          </span>
          {isInherited && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF] shrink-0 whitespace-nowrap cursor-help"
                  style={{ fontWeight: 600 }}
                >
                  <Check className="w-2.5 h-2.5" /> Inherited
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] z-[300]">
                <p className="text-[11px] text-slate-600 leading-snug">
                  Coming from the vendor's partner profile by default. Change it to override the payment terms for this invoice only.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {showPresetBadge && (
              <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[10px] shrink-0 tracking-wide ${
                isCustom
                  ? "bg-white border border-slate-200 text-slate-500"
                  : "bg-slate-100 text-slate-500"
              }`} style={{ fontWeight: 600 }}>
                {isCustom ? "Custom" : <><Lock className="w-2 h-2" /> Template</>}
              </span>
            )}
            {/* Partner group-selection control (user 10/1): the empty
                circle makes the card read selectable at rest; the filled
                primary check marks the pick. */}
            {selectControl && (
              isSelected ? (
                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white shrink-0 transition-colors group-hover:border-primary/50" />
              )
            )}
          </div>
          {!readOnly && onView && !showPresetBadge && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onDuplicate?.(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Duplicate</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => toast.info("Edit flow coming soon.")} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onView(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">View Details</p></TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="shrink-0 mb-1">
          <p className={`${compact ? "text-[12px]" : "text-[13px]"} text-foreground truncate`} style={{ fontWeight: 600 }}>{highlightMatch(term.name, searchText)}</p>
        </div>

        <div className={`${compact ? "h-auto mb-1.5" : "h-[32px] mb-2"} shrink-0`}>
          <p className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-500 line-clamp-2 leading-relaxed`} style={{ fontWeight: 400 }}>{highlightMatch(term.description, searchText)}</p>
        </div>

        {term.category === "split" ? (
          <SplitTierDisplay term={term} sliceIdx={sliceIdx} onSliceSelect={onSliceSelect} sliceDisabledReasons={sliceDisabledReasons} splitNote={splitNote} />
        ) : (
          <div className="flex items-baseline justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <span className={`${compact ? "text-[16px]" : "text-[22px]"} text-foreground leading-none tracking-tight`} style={{ fontWeight: 600 }}>
                {prepayPct !== null ? `${prepayPct}%` : ptDays}
              </span>
              <span className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-400`} style={{ fontWeight: 500 }}>
                {prepayPct !== null ? `at ${term.trigger}` : 'days'}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 ${compact ? "text-[10px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>
              <Building2 className="w-3 h-3" /> {inUseCount} in use
            </span>
          </div>
        )}

        {(term.applyDiscount || term.discountPercent) && (
          <div className="pt-1.5 shrink-0">
            <div className="flex items-center px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] ">
              <span className="text-slate-500" style={{ fontWeight: 400 }}>
                Early Pay {term.discountPercent || "2"}% within {term.discountPeriod || "10"} Days
              </span>
            </div>
          </div>
        )}
      </div>

      {showFooter && (
        <div className={`grid ${footerCols === 1 ? 'grid-cols-1' : footerCols === 2 ? 'grid-cols-2' : 'grid-cols-3'} border-t border-muted shrink-0`}>
          {onSeeDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onSeeDetail(term); }}
              className={`inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors ${footerCols > 1 ? 'border-r border-muted' : ''}`}
              style={{ fontWeight: 500 }}
            >
              <Eye className="w-3 h-3" /> See Detail
            </button>
          )}
          {onApply && (
            <button
              onClick={(e) => { e.stopPropagation(); onApply(term); }}
              className={`inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors ${onDuplicate ? 'border-r border-muted' : ''}`}
              style={{ fontWeight: 500 }}
            >
              <Check className="w-3 h-3" /> Apply
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(term); }}
              className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Copy className="w-3 h-3" /> Duplicate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
