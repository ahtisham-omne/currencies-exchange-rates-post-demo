import type React from "react";
import { Tag } from "lucide-react";
import { HoverCardContent } from "../ui/hover-card";

/* ─────────── Shared item hover-card content ───────────
 *
 * Single source of truth for the item-thumbnail hover popover used
 * across the system (Partners list "No. of Items" column, the
 * partner-detail Items tab, Transactions ledger, card view, etc.).
 * The fields shown mirror the canonical Items Library listing columns
 * — Primary Category, Inventory Control, On-Hand + Base Unit, Status,
 * Preferred Acquisition. The old "Stock Status" pill (In/Low/Out of
 * Stock) was dropped: it isn't a listing column (it ships hidden in the
 * Items module) and read as noise on this surface. Edit here and every
 * call site stays consistent.
 */

export interface ItemHoverFields {
  image: string;
  partNo: string;
  /** Primary category — shown in the dark header beside the manufacturer. */
  category: string;
  manufacturer?: string;
  description: string;
  /** Serialized / Non-Serialized / Lot Controlled. */
  inventoryControl?: string;
  onHand?: number;
  onHandUnit?: string;
  status?: "Active" | "Inactive";
  /** Purchased / Manufactured / Purchase. */
  preferredAcquisition?: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  Inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};
const ACQ_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Purchased: { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF" },
  Purchase: { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF" },
  Manufactured: { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
};

export function ItemHoverCardContent({
  image,
  partNo,
  category,
  manufacturer,
  description,
  inventoryControl,
  onHand,
  onHandUnit,
  status = "Active",
  preferredAcquisition,
}: ItemHoverFields) {
  const ss = STATUS_STYLES[status] || STATUS_STYLES.Active;
  const acq = preferredAcquisition ? ACQ_STYLES[preferredAcquisition] || ACQ_STYLES.Purchased : null;
  return (
    <HoverCardContent
      side="bottom"
      align="start"
      className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-3 relative">
          <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/5">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{partNo}</p>
            <p className="text-[11px] text-slate-400 truncate">{[category, manufacturer].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">{description}</p>
        <div className="flex items-center justify-between pt-1.5 border-t border-muted gap-3">
          <div>
            <p className="text-[10px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>On-Hand</p>
            <p className="text-[14px] text-slate-700" style={{ fontWeight: 600 }}>
              {(onHand ?? 0).toLocaleString()} <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{onHandUnit}</span>
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border" style={{ fontWeight: 600, color: ss.color, backgroundColor: ss.bg, borderColor: ss.border }}>
            {status}
          </span>
        </div>
        {(inventoryControl || (preferredAcquisition && acq)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {inventoryControl && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border bg-slate-50 text-slate-600 border-slate-200" style={{ fontWeight: 500 }}>
                <Tag className="w-2.5 h-2.5" />{inventoryControl}
              </span>
            )}
            {preferredAcquisition && acq && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border" style={{ fontWeight: 500, color: acq.color, backgroundColor: acq.bg, borderColor: acq.border }}>
                {preferredAcquisition}
              </span>
            )}
          </div>
        )}
      </div>
    </HoverCardContent>
  );
}
