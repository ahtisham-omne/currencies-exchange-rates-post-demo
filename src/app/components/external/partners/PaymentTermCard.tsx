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
  CircleSlash,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../../ui/tooltip";
import { toast } from "sonner";
import type { PaymentTermPreset } from "./partnerConstants";
import { useVendors } from "./VendorContext";
import { getVendorCountForPaymentTerm } from "./paymentTermUsage";

interface PaymentTermCardProps {
  term: PaymentTermPreset;
  /** Whether this card is currently selected (shows checkmark) */
  isSelected?: boolean;
  /** If provided, shows a removable (X) button */
  onRemove?: () => void;
  /** Called when the card body is clicked */
  onClick?: () => void;
  /** Called when "Apply" is clicked */
  onApply?: (term: PaymentTermPreset) => void;
  /** Called when "Duplicate" is clicked */
  onDuplicate?: (term: PaymentTermPreset) => void;
  /** Called when "View" is clicked */
  onView?: (term: PaymentTermPreset) => void;
  /** Whether this is a read-only context (hides Apply/Duplicate/Edit/Remove) */
  readOnly?: boolean;
  /** Optional search text to highlight */
  searchText?: string;
  /** Show preset/custom badge */
  showPresetBadge?: boolean;
  /** Term is disabled (inactive) — stays browsable but can't be applied.
   *  Shows a DISABLED pill and turns Apply into an explanatory error toast. */
  inactive?: boolean;
  /** Host addition (vendor invoicing picker card): the card itself is the
   *  selection control. A radio sits in the header, the selected card takes
   *  the primary border and tint, and the Apply footer is dropped. View
   *  Details moves to a hover icon in the header. */
  selectable?: boolean;
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

// Parse splits from description
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

// Interactive split tier display — matches pricing rules T1/T2/T3 pattern
function SplitTierDisplay({ term }: { term: PaymentTermPreset }) {
  const splits = parseSplits(term.description);
  const isMulti = splits.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const shown = splits[isMulti ? activeIdx : 0];
  const splitColor =
    term.category === "net" ? "#0A77FF"
    : term.category === "prepayment" ? "#6D28D9"
    : "#B45309";

  if (splits.length === 0) return null;

  return (
    <>
      {/* Hero value */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[22px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
          {splits.length}
        </span>
        <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
          {splits.length === 1 ? "split" : "splits"}
        </span>
      </div>

      {/* Split selector + detail row — matches pricing rules tier selector */}
      <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Split selector strip */}
        <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
          {isMulti && splits.map((s, i) => {
            const isActive = activeIdx === i;
            const typeColor = splitColor;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                className={`h-[22px] rounded-md text-[10px] transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                  isActive
                    ? "shadow-sm"
                    : "bg-muted text-slate-500 hover:bg-border"
                }`}
                style={{
                  fontWeight: isActive ? 600 : 500,
                  ...(isActive ? { backgroundColor: `${typeColor}18`, color: typeColor, boxShadow: `0 0 0 1px ${typeColor}40` } : {}),
                }}
              >
                S{i + 1}
                {isActive && (
                  <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>
                    {s.pct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Split detail row */}
        {shown && (
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] min-w-0">
            <span className="text-slate-500 capitalize truncate" style={{ fontWeight: 400 }}>{shown.label}</span>
            <span className="shrink-0 ml-2 text-foreground" style={{ fontWeight: 600 }}>{shown.pct}%</span>
          </div>
        )}
      </div>
    </>
  );
}

export function PaymentTermCard({
  term,
  isSelected,
  onRemove,
  onClick,
  onApply,
  onDuplicate,
  onView,
  readOnly = false,
  searchText,
  showPresetBadge = false,
  inactive = false,
  selectable = false,
}: PaymentTermCardProps) {
  // Single source of truth — same helper drives the partner list inside
  // PaymentTermDetailModal, so this pill always matches what the user sees
  // when they open the term.
  const { vendors } = useVendors();
  const inUseCount = getVendorCountForPaymentTerm(term, vendors);
  const ptDays = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  const pill =
    term.category === "net"
      ? { text: "#0A77FF", bg: "#EBF3FF", border: "#CFE6FF" }
      : term.category === "prepayment"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  const badgeColor = pill.text;
  const isCustom = term.id.startsWith("pt-custom-");
  const showFooter = !readOnly && !selectable && (onApply || onDuplicate);

  return (
    <div
      onClick={onClick}
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? !!isSelected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      } : undefined}
      className={`border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        isSelected
          ? selectable
            ? "bg-[#F5F9FF] border-primary shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
            : "bg-white border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "bg-white border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {/* Selected checkmark */}
      {isSelected && !selectable && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Remove button — appears on hover, matches ShippingMethodCarrierCard pattern */}
      {onRemove && !readOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-all z-10 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className={`${selectable ? "p-3.5" : "p-3"} flex-1 flex flex-col min-h-0 overflow-hidden`}>
        {/* Row 1: Type pill + optional badges/actions */}
        <div className={`flex items-center justify-between gap-2 ${selectable ? "mb-2.5" : "mb-2"} shrink-0`}>
          {/* Host fix: min-w-0 (was shrink-0) so a long trigger truncates instead of
              pushing the TEMPLATE / CUSTOM badge off the card (Split terms). */}
          <span className="inline-flex items-stretch rounded-full overflow-hidden border min-w-0" style={{ borderColor: pill.border }}>
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
            <span className="inline-flex items-center min-w-0 px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l max-w-[220px]" style={{ fontWeight: 500, borderColor: pill.border }}>
              {/* Splits carry multiple events; the single trigger field
                  stores the first one only. Render every parsed milestone
                  label so the pill matches the term's true scope. Truncate
                  with "+N more" when there's no horizontal room. */}
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
          {/* Selectable: hover View Details, title-case badges, radio */}
          {selectable && (
            <span className="flex items-center gap-1.5 shrink-0">
              {onView && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onView(term); }}
                      aria-label="View Details"
                      className="p-1 rounded-md text-slate-400 hover:text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[14300]"><p className="text-xs">View Details</p></TooltipContent>
                </Tooltip>
              )}
              {inactive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-amber-50 text-amber-700 text-[10px]" style={{ fontWeight: 500 }}>
                  <CircleSlash className="w-2.5 h-2.5" /> Disabled
                </span>
              )}
              {showPresetBadge && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] ${
                  isCustom ? "border border-slate-200 bg-white text-slate-500" : "bg-slate-100 text-slate-500"
                }`} style={{ fontWeight: 500 }}>
                  {isCustom ? "Custom" : <><Lock className="w-2.5 h-2.5" /> Template</>}
                </span>
              )}
              <span
                aria-hidden
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-primary" : "border-2 border-slate-300 bg-white group-hover:border-slate-400"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
            </span>
          )}
          {!selectable && (showPresetBadge || inactive) && (
            <span className="flex items-center gap-1 shrink-0">
              {inactive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[9px]" style={{ fontWeight: 600 }}>
                  <CircleSlash className="w-2.5 h-2.5" /> DISABLED
                </span>
              )}
              {showPresetBadge && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${
                  isCustom
                    ? "border-slate-300 bg-white text-muted-foreground"
                    : "bg-muted border-slate-300 text-slate-500"
                }`} style={{ fontWeight: 600 }}>
                  {isCustom ? "CUSTOM" : <><Lock className="w-2.5 h-2.5" /> TEMPLATE</>}
                </span>
              )}
            </span>
          )}
          {/* Hover actions for editable selected card */}
          {!readOnly && !selectable && onView && !showPresetBadge && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onDuplicate?.(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[14300]"><p className="text-xs">Duplicate</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => toast.info("Edit flow coming soon.")} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[14300]"><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onView(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                    <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[14300]"><p className="text-xs">View Details</p></TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{highlightMatch(term.name, searchText)}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlightMatch(term.description, searchText)}</p>
        </div>

        {/* Row 4: Hero value + split tier selector */}
        {term.category === "split" ? (
          <SplitTierDisplay term={term} />
        ) : (
          <div className="flex items-baseline justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
                {ptDays}
              </span>
              <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
              <Building2 className="w-3 h-3" /> {inUseCount} in use
            </span>
          </div>
        )}

        {/* Discount info strip */}
        {(term.applyDiscount || term.discountPercent) && (
          <div className={`${selectable ? "pt-2.5" : "pt-1.5"} shrink-0`}>
            <div className={`flex items-center rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] ${selectable ? "px-3 py-[7px]" : "px-2.5 py-[5px]"}`}>
              <span className="text-slate-500" style={{ fontWeight: 400 }}>
                {/* Payment term discounts are percent-only (fixed-$ removed). */}
                {selectable
                  ? `Early Pay ${term.discountPercent || "2"}% within ${term.discountPeriod || "10"} Days`
                  : `Early pay ${term.discountPercent || "2"}% within ${term.discountPeriod || "10"} days`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer — full-width 2-col CTAs. Host fix: when no Duplicate is offered
          (pickers), the second cell is View Details instead of an empty half. */}
      {showFooter && (
        <div className={`grid ${onApply && (onDuplicate || onView) ? "grid-cols-2" : "grid-cols-1"} border-t border-muted shrink-0`}>
          {onApply && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (inactive) {
                  // Disabled terms stay browsable but can't be applied —
                  // explain why instead of silently blocking.
                  toast.error(`${term.name} is disabled`, {
                    description: "Disabled terms can't be applied to partners. Enable it from the term detail to use it again.",
                  });
                  return;
                }
                onApply(term);
              }}
              className={`inline-flex items-center justify-center gap-1 py-2 text-[11px] transition-colors ${onDuplicate || onView ? "border-r border-muted" : ""} ${
                inactive ? "text-slate-300 hover:text-amber-700 hover:bg-amber-50/60 cursor-not-allowed" : "text-slate-500 hover:text-primary hover:bg-slate-50"
              }`}
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
          {!onDuplicate && onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(term); }}
              className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Eye className="w-3 h-3" /> View Details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
