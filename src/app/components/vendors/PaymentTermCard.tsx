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
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { toast } from "sonner";
import type { PaymentTermPreset } from "./partnerConstants";

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

  if (splits.length === 0) return null;

  return (
    <>
      {/* Hero value */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
          {splits.length}
        </span>
        <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
          {splits.length === 1 ? "split" : "splits"}
        </span>
      </div>

      {/* Split selector + detail row — matches pricing rules tier selector */}
      <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Split selector strip */}
        <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
          {isMulti && splits.map((s, i) => {
            const isActive = activeIdx === i;
            const typeColor = term.badgeColor;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                  isActive
                    ? "shadow-sm"
                    : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
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
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <span className="text-[#64748B] capitalize truncate" style={{ fontWeight: 400 }}>{shown.label}</span>
            <span className="shrink-0 ml-2 text-[#0F172A]" style={{ fontWeight: 600 }}>{shown.pct}%</span>
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
}: PaymentTermCardProps) {
  const ptDays = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  const badgeColor = term.badgeColor;
  const isCustom = term.id.startsWith("pt-custom-");
  const showFooter = !readOnly && (onApply || onDuplicate);

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isSelected
          ? "border-[#0A77FF]/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Remove button */}
      {onRemove && !readOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill + optional badges/actions */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: badgeColor + "40" }}>
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: badgeColor, backgroundColor: badgeColor + "15" }}
            >
              <Receipt className="w-3 h-3" />
              {term.typeBadge}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-[#64748B] border-l" style={{ fontWeight: 500, borderColor: badgeColor + "40" }}>
              {term.trigger}
            </span>
          </span>
          {showPresetBadge && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] shrink-0 ${
              isCustom
                ? "border-[#CBD5E1] bg-white text-[#475569]"
                : "bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B]"
            }`} style={{ fontWeight: 600 }}>
              {isCustom ? "CUSTOM" : <><Lock className="w-2.5 h-2.5" /> TEMPLATE</>}
            </span>
          )}
          {/* Hover actions for editable selected card */}
          {!readOnly && onView && !showPresetBadge && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onDuplicate?.(term)} className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                    <Copy className="w-3.5 h-3.5 text-[#94A3B8] hover:text-[#475569]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Duplicate</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => toast.info("Edit flow coming soon.")} className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-[#94A3B8] hover:text-[#475569]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onView(term)} className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                    <Eye className="w-3.5 h-3.5 text-[#94A3B8] hover:text-[#475569]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">View Details</p></TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlightMatch(term.name, searchText)}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlightMatch(term.description, searchText)}</p>
        </div>

        {/* Row 4: Hero value + split tier selector */}
        {term.category === "split" ? (
          <SplitTierDisplay term={term} />
        ) : (
          <div className="flex items-baseline justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
                {ptDays}
              </span>
              <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>days</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
              <Building2 className="w-3 h-3" /> {term.vendorsApplied} in use
            </span>
          </div>
        )}

        {/* Discount info strip */}
        {(term.applyDiscount || term.discountPercent) && (
          <div className="pt-1.5 shrink-0">
            <div className="flex items-center px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
              <span className="text-[#64748B]" style={{ fontWeight: 400 }}>
                Early pay {(term.discountMode ?? "percent") === "fixed" ? "$" : ""}{term.discountPercent || "2"}{(term.discountMode ?? "percent") === "percent" ? "%" : ""} within {term.discountPeriod || "10"} days
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer — full-width 2-col CTAs */}
      {showFooter && (
        <div className="grid grid-cols-2 border-t border-[#F1F5F9] shrink-0">
          {onApply && (
            <button
              onClick={(e) => { e.stopPropagation(); onApply(term); }}
              className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors border-r border-[#F1F5F9]"
              style={{ fontWeight: 500 }}
            >
              <Check className="w-3 h-3" /> Apply
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(term); }}
              className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors"
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
