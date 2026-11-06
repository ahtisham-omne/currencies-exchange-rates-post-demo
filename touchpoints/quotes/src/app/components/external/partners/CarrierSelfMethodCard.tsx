import { Plane, Truck, Ship, Layers, Pencil, Star, Trash2, Clock, MoreHorizontal, Eye } from "lucide-react";
import type { CarrierMethodEntry } from "./ShippingCarrierCard";
import { PrimaryPill } from "./PrimaryPill";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../ui/dropdown-menu";

/**
 * Card for a shipping method captured under a Carrier-profile partner
 * (where the partner IS the carrier). Layout:
 *
 *   Row 1: Mode pill (Air / Ground / Sea / Multi-modal) + PrimaryPill
 *          or set-as-primary star + Active/Inactive pill + three-dot
 *          menu (right)
 *   Row 2: Method name
 *   Row 3: Description (fixed 2-line height for grid uniformity)
 *   Row 4: Min–Max days delivery-window pill
 *
 * Per stakeholder ask (May 2026): the optional package-type metadata
 * (parcel/box/pallet/ltl/ftl) was dropped from the card surface — it
 * doesn't help shortlist a method at a glance and now lives only on
 * the detail view. The min/max days range is what the create flow
 * actually captures, so it gets a dedicated pill here.
 *
 * Same primary outline + soft glow on the primary card.
 */
export function CarrierSelfMethodCard({
  method,
  onView,
  onEdit,
  onRemove,
  onSetPrimary,
  onSetStatus,
  status,
}: {
  method: CarrierMethodEntry;
  onView?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onSetPrimary?: () => void;
  onSetStatus?: (next: "active" | "inactive") => void;
  status?: "active" | "inactive";
}) {
  const modeCfg = method.mode === "air"
    ? { Icon: Plane, label: "Air", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" }
    : method.mode === "sea"
      ? { Icon: Ship, label: "Sea", color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC" }
      // @ts-expect-error verbatim source comparison — "multi-modal" predates the CarrierMode type lockdown to "multi"; left as-is per verbatim port policy.
      : method.mode === "multi-modal"
        ? { Icon: Layers, label: "Multi-modal", color: "#92400E", bg: "#FFFBEB", border: "#FCD34D" }
        : { Icon: Truck, label: "Ground", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };

  const { Icon: ModeIcon } = modeCfg;
  const unit = method.leadTimeUnit || "days";
  const range = method.minDays === method.maxDays
    ? `${method.minDays} ${unit}`
    : `${method.minDays}–${method.maxDays} ${unit}`;
  const effStatus: "active" | "inactive" = status ?? "active";
  const isPrimary = !!method.isDefault;
  const showMenu = Boolean(onView || onEdit || onRemove || onSetStatus);

  // Primary card: blue outline + soft glow, matching F&L card.
  const primaryBorder = "#0A77FF66";
  const primaryShadow = "0 2px 12px -4px rgba(10,119,255,0.12)";
  const primaryHoverShadow = "0 4px 20px -4px rgba(10,119,255,0.18)";

  return (
    <div
      onClick={onView}
      className={`bg-white border rounded-xl group transition-all duration-200 flex flex-col relative ${
        onView ? "cursor-pointer" : ""
      } ${isPrimary ? "border-[1.5px]" : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.03)]"}`}
      style={isPrimary ? { borderColor: primaryBorder, boxShadow: primaryShadow } : undefined}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.boxShadow = primaryHoverShadow;
        } else {
          e.currentTarget.style.borderColor = "#BFDBFE";
          e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE";
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.boxShadow = primaryShadow;
        } else {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
        }
      }}
    >
      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Mode pill (left) + Primary star/badge + Active pill +
            three-dot menu (right). Package-type metadata was dropped
            per stakeholder ask — optional, doesn't help triage at a
            glance, and the create flow only captures it as a side note. */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full border text-[10px] shrink-0"
            style={{ fontWeight: 600, color: modeCfg.color, backgroundColor: modeCfg.bg, borderColor: modeCfg.border }}
          >
            <ModeIcon className="w-3 h-3" /> {modeCfg.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isPrimary ? (
              <PrimaryPill />
            ) : onSetPrimary ? (
              <button
                type="button"
                onClick={onSetPrimary}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                title="Set as primary"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <span
              className="px-2 py-[2px] rounded-full text-[10px] border"
              style={
                effStatus === "active"
                  ? { fontWeight: 500, color: "#166534", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
                  : { fontWeight: 500, color: "#64748B", backgroundColor: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {effStatus === "active" ? "Active" : "Inactive"}
            </span>
            {showMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                    title="Method actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-1 z-[14200]" onClick={(e) => e.stopPropagation()}>
                  {onView && (
                    <DropdownMenuItem className="gap-2 py-1.5 cursor-pointer text-[13px]" onSelect={() => onView()}>
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem className="gap-2 py-1.5 cursor-pointer text-[13px]" onSelect={() => onEdit()}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit Method
                    </DropdownMenuItem>
                  )}
                  {onSetStatus && (
                    effStatus === "active" ? (
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px] text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                        onSelect={(e) => { e.preventDefault(); onSetStatus("inactive"); }}
                      >
                        <Star className="w-3.5 h-3.5 text-amber-600" /> Mark as Inactive
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px]"
                        onSelect={(e) => { e.preventDefault(); onSetStatus("active"); }}
                      >
                        <Star className="w-3.5 h-3.5 text-slate-500" /> Mark as Active
                      </DropdownMenuItem>
                    )
                  )}
                  {onRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px] text-destructive focus:text-destructive focus:bg-red-50"
                        onSelect={(e) => { e.preventDefault(); onRemove(); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" /> Remove
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Row 2: Method name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{method.name}</p>
        </div>

        {/* Row 3: Description — fixed 2-line height */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>
            {method.desc || "Custom shipping method"}
          </p>
        </div>

        {/* Row 4: Delivery-window pill — surfaces the min–max days the
            create flow captures. Uses the canonical labeled-pill style
            (small slate label on the left, tabular-nums range on the
            right) so the unit is unambiguous at a glance. */}
        <div className="mt-auto pt-2 shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md border border-[#E8ECF1] bg-[#F8FAFC] text-[10.5px] text-slate-600 tabular-nums"
            style={{ fontWeight: 600 }}
            title={method.minDays === method.maxDays ? `Delivery in ${range}` : `Delivery between ${method.minDays} and ${method.maxDays} ${unit}`}
          >
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400" style={{ fontWeight: 500 }}>Delivery</span>
            {range}
          </span>
        </div>
      </div>
    </div>
  );
}
