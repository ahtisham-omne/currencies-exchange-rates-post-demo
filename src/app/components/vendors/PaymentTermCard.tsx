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
  /** Hover pencil. Given one, the card's Edit action runs it instead of the
   *  partner module's "coming soon" toast -- the return's rail opens Browse
   *  Payment Terms from it. */
  onEdit?: (term: PaymentTermPreset) => void;
  readOnly?: boolean;
  searchText?: string;
  showPresetBadge?: boolean;
  /** Marks this term as inherited from the vendor's partner default —
   *  renders a tooltip'd "Inherited" pill next to the type pill, matching
   *  the Freight & Logistics CarrierCard. */
  isInherited?: boolean;
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
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[22px] text-foreground tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
          {splits.length}
        </span>
        <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
          {splits.length === 1 ? "split" : "splits"}
        </span>
      </div>

      <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
          {isMulti && splits.map((s, i) => {
            const isActive = activeIdx === i;
            const typeColor = splitColor;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
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
        {shown && (
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
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
  hideCheckmark = false,
  compact = false,
  onRemove,
  onClick,
  onApply,
  onDuplicate,
  onView,
  onEdit,
  readOnly = false,
  searchText,
  showPresetBadge = false,
  isInherited = false,
}: PaymentTermCardProps) {
  // Source the "in use" count directly from the preset record. The partner
  // module derives this from a VendorContext lookup; the vendor-invoicing
  // app doesn't ship that provider, so we read the pre-baked count instead.
  const inUseCount = term.vendorsApplied;
  const ptDays = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  const pill =
    term.category === "net"
      ? { text: "#0A77FF", bg: "#EFF6FF", border: "#DBEAFE" }
      : term.category === "prepayment"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  const isCustom = term.id.startsWith("pt-custom-");
  const showFooter = !readOnly && (onApply || onDuplicate);

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isSelected
          ? "border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {isSelected && !hideCheckmark && (
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
          {showPresetBadge && (
            <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[10px] shrink-0 tracking-wide ${
              isCustom
                ? "bg-white border border-slate-200 text-slate-500"
                : "bg-slate-100 text-slate-500"
            }`} style={{ fontWeight: 600 }}>
              {isCustom ? "CUSTOM" : <><Lock className="w-2 h-2" /> TEMPLATE</>}
            </span>
          )}
          {!readOnly && (onView || onEdit) && !showPresetBadge && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              {onDuplicate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => onDuplicate(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                      <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[300]"><p className="text-xs">Duplicate</p></TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => (onEdit ? onEdit(term) : toast.info("Edit flow coming soon."))}
                    aria-label="Edit payment terms"
                    className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
              {onView && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => onView(term)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                      <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[300]"><p className="text-xs">View Details</p></TooltipContent>
                </Tooltip>
              )}
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
          <SplitTierDisplay term={term} />
        ) : (
          <div className="flex items-baseline justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <span className={`${compact ? "text-[16px]" : "text-[22px]"} text-foreground tabular-nums leading-none tracking-tight`} style={{ fontWeight: 600 }}>
                {ptDays}
              </span>
              <span className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-400`} style={{ fontWeight: 500 }}>days</span>
            </div>
            <span className={`inline-flex items-center gap-1 ${compact ? "text-[10px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>
              <Building2 className="w-3 h-3" /> {inUseCount} in use
            </span>
          </div>
        )}

        {(term.applyDiscount || term.discountPercent) && (
          <div className="pt-1.5 shrink-0">
            <div className="flex items-center px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
              <span className="text-slate-500" style={{ fontWeight: 400 }}>
                Early pay {term.discountPercent || "2"}% within {term.discountPeriod || "10"} days
              </span>
            </div>
          </div>
        )}
      </div>

      {showFooter && (
        <div className="grid grid-cols-2 border-t border-muted shrink-0">
          {onApply && (
            <button
              onClick={(e) => { e.stopPropagation(); onApply(term); }}
              className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-muted"
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
