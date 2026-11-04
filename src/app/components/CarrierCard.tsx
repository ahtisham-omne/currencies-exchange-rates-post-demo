import { Truck, Clock, Check, Star, Package } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/app/components/ui/tooltip';
import {
  type VendorCarrier,
  type CarrierStatus,
} from '@/app/data/vendorCarriers';

interface CarrierCardProps {
  carrier: VendorCarrier;
  isSelected?: boolean;
  /** Suppress the floating checkmark even when selected — used for the
   *  freight section's "current carrier" summary where the card already
   *  represents the active choice. */
  hideCheckmark?: boolean;
  /** Tighter padding + reduced gaps for the sidebar summary slot. */
  compact?: boolean;
  /** Read-only summary — no hover affordances, no Apply footer. */
  readOnly?: boolean;
  /** Marks this card as the vendor's inherited default carrier. */
  isVendorDefault?: boolean;
  onClick?: () => void;
  onApply?: (carrier: VendorCarrier) => void;
  searchText?: string;
  showStatusBadge?: boolean;
}

// Status pill palette — 1:1 with the partner ShippingMethodCarrierCard
// (rounded-md bordered chip, no dot). Active = emerald, Under Review =
// amber, Inactive = muted slate.
const STATUS_STYLE: Record<CarrierStatus, { bg: string; color: string; border: string }> = {
  Active: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  'Under Review': { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  Inactive: { bg: 'hsl(var(--muted))', color: '#64748B', border: 'hsl(var(--border))' },
};

function highlightMatch(text: string, query?: string) {
  if (!query || !query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Partner-style Freight & Logistics carrier card. A faithful port of the
 * Partner module's `ShippingMethodCarrierCard` (Partner details → Freight &
 * Logistics tab): "Carrier · N Methods" split pill, rounded-md status chip,
 * blue Primary badge with filled star, name-only identity, and the bottom
 * method/transit strip box. Used both as the read-only summary in the freight
 * section and as the selectable card in the browse modal grid.
 */
export function CarrierCard({
  carrier,
  isSelected,
  hideCheckmark = false,
  compact = false,
  readOnly = false,
  isVendorDefault = false,
  onClick,
  onApply,
  searchText,
  showStatusBadge = false,
}: CarrierCardProps) {
  const status = STATUS_STYLE[carrier.status];
  const transit =
    carrier.minDays === carrier.maxDays
      ? `${carrier.minDays} day${carrier.minDays !== 1 ? 's' : ''}`
      : `${carrier.minDays}–${carrier.maxDays} days`;
  const showFooter = !readOnly && !!onApply;

  // Border treatment, in priority order:
  //  1. Actively selected in the browse grid → blue ring + floating check.
  //  2. Vendor default / primary carrier → partner primary outline (1.5px
  //     blue + soft blue glow), so the active default reads at a glance.
  //  3. Everything else → resting border with a blue hover lift.
  const showSelectionRing = isSelected && !hideCheckmark;
  const isPrimaryOutline = !showSelectionRing && (isVendorDefault || carrier.isPrimary);

  const borderClasses = showSelectionRing
    ? 'border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]'
    : isPrimaryOutline
      ? 'border-[1.5px]'
      : `border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${onClick && !readOnly ? 'hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]' : ''}`;

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl group transition-all duration-200 flex flex-col relative h-full ${onClick ? 'cursor-pointer' : ''} ${borderClasses}`}
      style={isPrimaryOutline ? { borderColor: '#0A77FF66', boxShadow: '0 2px 12px -4px rgba(10,119,255,0.12)' } : undefined}
    >
      {showSelectionRing && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className={`${compact ? 'p-2.5' : 'p-3'} flex-1 flex flex-col min-h-0 overflow-hidden`}>
        {/* Row 1 — "Carrier · N Method" split pill (left) + Inherited /
            Primary / status (right). Mirrors the partner card header. */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-stretch rounded-full overflow-hidden border border-blue-200 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-blue-800 bg-blue-50" style={{ fontWeight: 600 }}>
                <Truck className="w-3 h-3" /> Carrier
              </span>
              <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-blue-200" style={{ fontWeight: 500 }}>
                1 Method
              </span>
            </span>
            {isVendorDefault && (
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
                    Coming from the vendor's partner profile by default. Change it to override the carrier for this invoice only.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {carrier.isPrimary && (
              <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border border-blue-200 bg-blue-50 text-blue-800" style={{ fontWeight: 600 }}>
                <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
                Primary
              </span>
            )}
            {showStatusBadge && (
              <span
                className="px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                style={{ fontWeight: 500, backgroundColor: status.bg, color: status.color, borderColor: status.border }}
              >
                {carrier.status}
              </span>
            )}
          </div>
        </div>

        {/* Row 2, Carrier name (no avatar, matching partner card) */}
        <div className="shrink-0 mb-1">
          <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} text-slate-700 truncate`} style={{ fontWeight: 600 }}>
            {highlightMatch(carrier.name, searchText)}
          </p>
        </div>

        {/* Row 3, Description, fixed 2-line height to keep grid cells
            uniform. Hidden in compact slot. */}
        {!compact && (
          <div className="h-[32px] shrink-0 mb-2">
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>
              {carrier.desc}
            </p>
          </div>
        )}

        {/* Row 4, Active method detail strip: method name (left),
            transit window (right). 1:1 with the partner card footer. */}
        <div className="mt-auto pt-2 shrink-0">
          <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] ">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <Package className="w-3 h-3 text-slate-400 shrink-0" />
              {/* The picker search matches method name too, so it highlights (10/9/26). */}
              <span className="truncate" style={{ fontWeight: 400 }}>{highlightMatch(carrier.methodName, searchText)}</span>
            </div>
            <span className="shrink-0 ml-2 inline-flex items-center gap-1 text-slate-500" style={{ fontWeight: 600 }}>
              <Clock className="w-3 h-3 text-slate-400" />
              {transit}
            </span>
          </div>
        </div>
      </div>

      {showFooter && (
        <div className="border-t border-muted shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onApply!(carrier); }}
            className="w-full inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Check className="w-3 h-3" /> Apply
          </button>
        </div>
      )}
    </div>
  );
}
