/* ═══════════════════════════════════════════════════════════════
   MultiUnitPriceTable — inline editable table of (unit, price)
   tiers per vendor-item. Used by the Item Detail / OrderFlow modal.

   Behaviors
   - Inline edit: pencil icon switches a row to a $ input + Save / Cancel
   - Inline remove: ✕ removes the row
   - Star: tier flagged as the default
   - "+ Add another unit price": opens a new row with a UOM dropdown
     limited to units NOT already configured + a $ input
   - $0 is a fully valid price — no validation blocks empty / zero entries
   ═══════════════════════════════════════════════════════════════ */

"use client";

import * as React from "react";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import type { VendorUnitPrice } from "./catalogData";
import { UnitCombobox } from "./UnitCombobox";
import { baseUnitOf, conversionFactorOf, getCompatibleUOMs } from "./uomRegistry";

const FONT = "'PP Object Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export interface MultiUnitPriceTableProps {
  tiers: VendorUnitPrice[];
  /** UOM currently selected on the line item — highlighted in the table */
  currentVendorUnit?: string;
  /** Set of unit names (lowercased) that are already configured — used to
   *  filter the "Add new unit" dropdown so we don't allow duplicates. */
  configuredUnits: Set<string>;
  /** Item's primary stocking UOM. Drives:
   *   - the add-row picker's dimension filter (volume items only see
   *     volume units, count items only see count units),
   *   - the inline "(N <baseUnit>)" hint shown next to each tier,
   *   - the default unit pre-filled when the add row opens. */
  itemBaseUnit?: string;
  /** Optional vendor name used in the helper subtitle above the
   *  header row ("Units qualified with {vendor}. …"). When omitted a
   *  generic copy is shown. */
  vendorName?: string;

  // Inline edit state (driven by parent)
  editTierUnit: string | null;
  tierDraftPrice: string;
  setTierDraftPrice: (v: string) => void;
  // Add state (driven by parent)
  addTierMode: boolean;
  addTierUnit: string;
  setAddTierUnit: (v: string) => void;
  addTierPrice: string;
  setAddTierPrice: (v: string) => void;

  onBeginEditTier: (unit: string) => void;
  onCommitEditTier: (unit: string) => void;
  onCancelEditTier: () => void;
  onRemoveTier: (unit: string) => void;
  onSetDefault: (unit: string) => void;
  onBeginAdd: () => void;
  onCancelAdd: () => void;
  onCommitAdd: () => void;
}

export function MultiUnitPriceTable(props: MultiUnitPriceTableProps) {
  const {
    tiers,
    currentVendorUnit,
    configuredUnits,
    vendorName,
    itemBaseUnit,
    editTierUnit,
    tierDraftPrice,
    setTierDraftPrice,
    addTierMode,
    addTierUnit,
    setAddTierUnit,
    addTierPrice,
    setAddTierPrice,
    onBeginEditTier,
    onCommitEditTier,
    onCancelEditTier,
    onRemoveTier,
    onSetDefault,
    onBeginAdd,
    onCancelAdd,
    onCommitAdd,
  } = props;

  /* Disable the "+ Add another unit price" CTA when every compatible
     unit in the registry has already been configured on this vendor. */
  const compatibleUnconfiguredCount = React.useMemo(() => {
    if (!itemBaseUnit) return Infinity;
    const compat = getCompatibleUOMs(itemBaseUnit);
    if (compat.length === 0) return Infinity;
    return compat.filter((u) => !configuredUnits.has(u.name.toLowerCase())).length;
  }, [itemBaseUnit, configuredUnits]);

  return (
    <div
      className="mt-3 rounded-lg border border-[#E2E8F0] overflow-hidden"
      style={{ fontFamily: FONT, background: "#FFFFFF" }}
    >
      {/* Helper subtitle above the header row — explains what the
          table is showing:
            · rows are units qualified with the active vendor,
            · rows carrying the "PO only" chip are ad-hoc alternatives
              added for the current PO but not persisted to the vendor,
            · "+ Add another unit price" adds a new alternative unit
              (which starts as PO-only until the buyer promotes it via
              "Update Qualified Vendor & Use Here"). */}
      <div
        className="px-3 py-2 border-b border-[#E2E8F0]"
        style={{ background: "#FFFFFF" }}
      >
        <p
          className="text-[11px] leading-snug text-[#64748B]"
          style={{ fontFamily: FONT, fontWeight: 500 }}
        >
          Units qualified with{" "}
          <span className="text-[#334155]" style={{ fontWeight: 600 }}>
            {vendorName || "this vendor"}
          </span>
          . Tiers marked{" "}
          <span
            className="inline-flex items-center px-1 rounded align-middle"
            style={{
              background: "#FEF3C7",
              color: "#92400E",
              fontSize: 9,
              fontWeight: 600,
              lineHeight: "13px",
              letterSpacing: "0.02em",
            }}
          >
            PO only
          </span>{" "}
          are alternatives applied to this PO only; the rest are
          qualified with the vendor.
        </p>
      </div>

      {/* Header */}
      <div
        className="grid grid-cols-[1.4fr_1fr_auto] items-center px-3 py-2"
        style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
          Unit
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
          Price
        </span>
        <span />
      </div>

      {/* Rows */}
      {tiers.map((tier) => {
        const isEditing = editTierUnit === tier.unit;
        const isCurrent =
          currentVendorUnit && tier.unit.trim().toLowerCase() === currentVendorUnit.trim().toLowerCase();

        return (
          <div
            key={tier.unit}
            className="grid grid-cols-[1.4fr_1fr_auto] items-center px-3 py-2"
            style={{
              borderTop: "1px solid #F1F5F9",
              background: isCurrent ? "rgba(10,119,255,0.04)" : "transparent",
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="truncate"
                style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}
                title={tier.unit}
              >
                {tier.unit}
              </span>
              {/* Conversion hint, sourced from the registry whenever
                  possible so the base unit follows the item (Gallon,
                  Pound, etc.) instead of the legacy "ea" string.
                  Falls back to the stored conversionFactor for tiers
                  that pre-date the registry. */}
              {(() => {
                const registryFactor = conversionFactorOf(tier.unit);
                const factor =
                  registryFactor !== 1 ? registryFactor : tier.conversionFactor ?? 1;
                if (!factor || factor <= 1) return null;
                const base = baseUnitOf(tier.unit) || itemBaseUnit || "ea";
                return (
                  <span style={{ fontSize: 10.5, fontWeight: 400, color: "#94A3B8" }}>
                    ({factor} {base})
                  </span>
                );
              })()}
              {tier.isDefault && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 rounded"
                  style={{ background: "#EFF6FF", color: "#0A77FF", fontSize: 9.5, fontWeight: 600, marginLeft: 2 }}
                >
                  <Star className="w-2.5 h-2.5" /> default
                </span>
              )}
              {/* Ad-hoc "for this PO only" tier — not persisted to the
                  qualified vendor's master price book. Amber chip so it
                  reads distinct from the blue "default" chip. */}
              {tier.poOnly && (
                <span
                  className="inline-flex items-center px-1.5 rounded"
                  style={{
                    background: "#FEF3C7",
                    color: "#92400E",
                    fontSize: 9.5,
                    fontWeight: 600,
                    marginLeft: 2,
                    lineHeight: "14px",
                  }}
                  title="This tier is applied to the current PO only. The qualified vendor's master price book is unchanged."
                >
                  PO only
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="flex items-center rounded-md border border-[#0A77FF]/40 bg-white overflow-hidden">
                <span className="pl-2 text-[#94A3B8]" style={{ fontSize: 12 }}>$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tierDraftPrice}
                  autoFocus
                  onChange={(e) => setTierDraftPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onCommitEditTier(tier.unit);
                    if (e.key === "Escape") onCancelEditTier();
                  }}
                  className="h-7 w-full px-1 outline-none bg-transparent text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontFamily: FONT, fontWeight: 600, color: "#0F172A" }}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, color: tier.price > 0 ? "#0F172A" : "#94A3B8" }}>
                ${tier.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}

            <div className="flex items-center gap-1 justify-end">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => onCommitEditTier(tier.unit)}
                    className="w-6 h-6 rounded inline-flex items-center justify-center text-white cursor-pointer"
                    style={{ background: "#0A77FF" }}
                    title="Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditTier}
                    className="w-6 h-6 rounded inline-flex items-center justify-center border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  {!tier.isDefault && (
                    <button
                      type="button"
                      onClick={() => onSetDefault(tier.unit)}
                      className="w-6 h-6 rounded inline-flex items-center justify-center border border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0A77FF] cursor-pointer"
                      title="Make default"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onBeginEditTier(tier.unit)}
                    className="w-6 h-6 rounded inline-flex items-center justify-center border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
                    title="Edit"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveTier(tier.unit)}
                      className="w-6 h-6 rounded inline-flex items-center justify-center border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Add new tier row */}
      {addTierMode ? (
        <div
          className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-1 px-3 py-2"
          style={{ borderTop: "1px solid #F1F5F9", background: "#F8FAFC" }}
        >
          {/* Searchable UOM picker, filtered to units in the SAME
              dimension as the item's base unit (so a Gallon-stocked
              item only sees volume units like Drum / Liter / Tote)
              and excludes units already configured on this vendor. */}
          <UnitCombobox
            value={addTierUnit}
            onChange={setAddTierUnit}
            itemBaseUnit={itemBaseUnit}
            hideUnits={configuredUnits}
            placeholder="Choose unit…"
            size="sm"
          />

          <div className="flex items-center rounded-md border border-[#E2E8F0] bg-white overflow-hidden">
            <span className="pl-2 text-[#94A3B8]" style={{ fontSize: 12 }}>$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={addTierPrice}
              onChange={(e) => setAddTierPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && addTierUnit) onCommitAdd();
                if (e.key === "Escape") onCancelAdd();
              }}
              placeholder="0.00"
              className="h-7 w-full px-1 outline-none bg-transparent text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ fontFamily: FONT, fontWeight: 600, color: "#0F172A" }}
            />
          </div>

          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={onCommitAdd}
              disabled={!addTierUnit}
              className="w-6 h-6 rounded inline-flex items-center justify-center text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#0A77FF" }}
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelAdd}
              className="w-6 h-6 rounded inline-flex items-center justify-center border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : compatibleUnconfiguredCount > 0 ? (
        <button
          type="button"
          onClick={onBeginAdd}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] text-[#0A77FF] hover:bg-[#F8FAFC] cursor-pointer"
          style={{ borderTop: "1px solid #F1F5F9", fontWeight: 500, fontFamily: FONT }}
        >
          <Plus className="w-3.5 h-3.5" /> Add another unit price
        </button>
      ) : null}
    </div>
  );
}
