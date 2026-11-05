import React, { useState } from "react";
import { Truck, Clock, Star, X, Package, Check } from "lucide-react";

import fedexLogo from "@/assets/carriers/fedex.png";
import dhlLogo from "@/assets/carriers/dhl.png";
import upsLogo from "@/assets/carriers/ups.png";
import tcsLogo from "@/assets/carriers/tcs.png";
import sfLogo from "@/assets/carriers/sf.png";
import uspsLogo from "@/assets/carriers/usps.png";
import aramexLogo from "@/assets/carriers/aramex.png";
import maerskLogo from "@/assets/carriers/maersk.png";

export type CarrierStatus = "Active" | "Under Review" | "Inactive";

/** Transportation mode the carrier primarily operates in. "multi" covers
 *  carriers that genuinely run multiple modes (e.g. UPS doing ground+air). */
export type CarrierMode = "air" | "ground" | "sea" | "multi";

/** Standard freight terminology. parcel/box for small shipments;
 *  pallet/ltl/ftl for freight (less-than-truckload, full-truckload). */
export type PackageType = "parcel" | "box" | "pallet" | "ltl" | "ftl";

/** Lead-time ranges are intentionally broad — for ocean freight days/weeks
 *  matters; for air it's days. The unit lets the card render the right scale. */
export type LeadTimeUnit = "days" | "weeks" | "months";

export interface CarrierCatalogEntry {
  id: string;
  name: string;
  logoImg: string;
  color: string;
  desc: string;
  status: CarrierStatus;
  mode: CarrierMode;
  leadTimeRange: { min: number; max: number; unit: LeadTimeUnit };
  packageTypes: PackageType[];
  regions: string[];
  /** True when this entry represents a pickup (self-service) rather than a
   *  third-party carrier — e.g. Customer Pickup or Vendor Pickup. Pickup
   *  rows ship with no pre-seeded methods (the user adds custom modes) and
   *  the carrier dropdown pins them in their own subsection at the top of
   *  the list so they don't get lost between FedEx / UPS / DHL etc. */
  isPickup?: boolean;
}

/** Display copy for modes — kept as a lookup so the card and any future
 *  carrier-creation UI stay in sync without stringly-typed labels. */
export const CARRIER_MODE_LABELS: Record<CarrierMode, string> = {
  air: "Air",
  ground: "Ground",
  sea: "Sea",
  multi: "Multi-modal",
};

/** Mode → tag colors. Air = sky blue, Ground = slate, Sea = teal,
 *  Multi = violet to read as "more than one of the above". */
export const CARRIER_MODE_COLORS: Record<CarrierMode, { bg: string; text: string; border: string }> = {
  air: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  ground: { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
  sea: { bg: "#F0FDFA", text: "#0F766E", border: "#99F6E4" },
  multi: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
};

/** Display copy for package types. "ltl" / "ftl" stay uppercase to match
 *  industry usage. */
export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  parcel: "Parcel",
  box: "Box",
  pallet: "Pallet",
  ltl: "LTL",
  ftl: "FTL",
};

export interface CarrierMethodEntry {
  id: string;
  name: string;
  shortName: string;
  desc: string;
  minDays: number;
  maxDays: number;
  cost: string;
  isDefault?: boolean;
  /** Transportation mode this method runs on (Air, Ground, Sea, Multi-modal).
   *  Optional only for back-compat with seed entries that pre-date the field —
   *  new methods created via the Create Shipping Method modal must capture it. */
  mode?: CarrierMode;
  /** Unit for the minDays/maxDays range. Defaults to "days" when absent so
   *  legacy entries keep rendering correctly; ocean freight typically uses
   *  weeks, multi-month transit uses months. */
  leadTimeUnit?: LeadTimeUnit;
  /** Package types this method handles (parcel/box/pallet/ltl/ftl). */
  packageTypes?: PackageType[];
  /** Service regions covered. Free-text by design — geography for v1 is
   *  just a coverage hint, not a structured locality. */
  regions?: string[];
  /** Custom-packaging dimensions for a representative shipment. Optional —
   *  the Coverage step lets users pick between standard package types
   *  (parcel/box/pallet/…) or capture explicit Weight/L/W/H for irregular
   *  cargo. Stored as strings so partial entries (just weight, just height)
   *  round-trip without forcing a numeric default. */
  dimensions?: {
    weight?: string;
    length?: string;
    width?: string;
    height?: string;
  };
}

/* Shared carrier catalog used everywhere shipping methods are configured.
   Lead-time ranges and package-type lists are starting estimates — Irtaza is
   validating per-carrier against real data. Don't ship-time-critical decisions
   off these numbers until that pass lands. */
export const SHIPPING_CARRIER_CATALOG: CarrierCatalogEntry[] = [
  // ─ Pickup options (no third-party carrier — self-service handoff) ─
  // System uses the partner's default staging location for the pickup
  // point, so no per-row location field is needed. Pickup rows ship with
  // zero pre-seeded methods — users add custom modes from the
  // Create Shipping Method modal (a pickup carrier can exist with no
  // method by design, unlike third-party carriers).
  { id: "customer-pickup", name: "Customer Pickup", logoImg: "", color: "#1E40AF", desc: "Customer picks up the order from our staging location — no third-party carrier handoff. Add custom pickup modes (e.g. Same-Day Pickup, Will-Call) as needed.", status: "Active", mode: "ground", leadTimeRange: { min: 0, max: 1, unit: "days" }, packageTypes: ["parcel", "box", "pallet"], regions: ["Local"], isPickup: true },
  { id: "vendor-pickup", name: "Vendor Pickup", logoImg: "", color: "#065F46", desc: "We pick up directly from the vendor's staging location — no third-party carrier handoff. Add custom pickup modes (e.g. Driver Schedule, Will-Call) as needed.", status: "Active", mode: "ground", leadTimeRange: { min: 0, max: 1, unit: "days" }, packageTypes: ["parcel", "box", "pallet"], regions: ["Local"], isPickup: true },
  // ─ Third-party carriers ─
  { id: "fedex", name: "FedEx Express", logoImg: fedexLogo, color: "#4D148C", desc: "Premium express shipping for time-critical deliveries", status: "Active", mode: "air", leadTimeRange: { min: 1, max: 3, unit: "days" }, packageTypes: ["parcel", "box"], regions: ["North America", "Europe"] },
  { id: "tcs", name: "TCS (Tranzum Courier Service)", logoImg: tcsLogo, color: "#D32F2F", desc: "Regional express courier for South Asian markets", status: "Active", mode: "ground", leadTimeRange: { min: 2, max: 5, unit: "days" }, packageTypes: ["parcel", "box"], regions: ["South Asia"] },
  { id: "dhl", name: "DHL Express", logoImg: dhlLogo, color: "#FFCC00", desc: "Global logistics and international shipping solutions", status: "Active", mode: "air", leadTimeRange: { min: 2, max: 5, unit: "days" }, packageTypes: ["parcel", "box"], regions: ["Global"] },
  { id: "ups", name: "UPS (United Parcel Service)", logoImg: upsLogo, color: "#351C15", desc: "Reliable ground freight and parcel services", status: "Active", mode: "multi", leadTimeRange: { min: 1, max: 7, unit: "days" }, packageTypes: ["parcel", "box", "pallet", "ltl"], regions: ["North America"] },
  { id: "sf", name: "SF Express", logoImg: sfLogo, color: "#1A1A1A", desc: "Fast domestic and cross-border parcel delivery", status: "Active", mode: "ground", leadTimeRange: { min: 2, max: 7, unit: "days" }, packageTypes: ["parcel", "box"], regions: ["Asia-Pacific"] },
  { id: "usps", name: "USPS", logoImg: uspsLogo, color: "#004B87", desc: "Affordable domestic mail and parcel service", status: "Active", mode: "multi", leadTimeRange: { min: 3, max: 7, unit: "days" }, packageTypes: ["parcel"], regions: ["North America"] },
  { id: "aramex", name: "Aramex", logoImg: aramexLogo, color: "#E65100", desc: "International express delivery and logistics", status: "Active", mode: "multi", leadTimeRange: { min: 2, max: 7, unit: "days" }, packageTypes: ["parcel", "box"], regions: ["Middle East", "Global"] },
  { id: "maersk", name: "Maersk", logoImg: maerskLogo, color: "#0067A5", desc: "World-leading ocean container shipping", status: "Active", mode: "sea", leadTimeRange: { min: 4, max: 8, unit: "weeks" }, packageTypes: ["ftl", "pallet"], regions: ["Global"] },
];

export const SHIPPING_CARRIER_METHODS: Record<string, CarrierMethodEntry[]> = {
  // Pickup carriers ship with NO pre-seeded methods — users add custom
  // modes from the Create Shipping Method modal. Empty arrays here so
  // method-lookups don't crash; they also signal "carrier with no method"
  // is a valid state for pickup rows.
  "customer-pickup": [],
  "vendor-pickup": [],
  fedex: [
    { id: "fedex-air", name: "FedEx Express (Air)", shortName: "Air", desc: "Priority overnight & international air freight", minDays: 1, maxDays: 2, cost: "$45.00", isDefault: true },
    { id: "fedex-ground", name: "FedEx Ground (Land)", shortName: "Ground", desc: "Cost-effective ground shipping across regions", minDays: 5, maxDays: 7, cost: "$12.00" },
    { id: "fedex-freight", name: "FedEx Freight", shortName: "Freight", desc: "For larger shipments & palletized cargo", minDays: 7, maxDays: 14, cost: "$22.00" },
    { id: "fedex-intl-priority", name: "FedEx International Priority", shortName: "Intl Priority", desc: "Fast customs-cleared international delivery", minDays: 1, maxDays: 2, cost: "$58.00" },
    { id: "fedex-intl-econ", name: "FedEx International Economy", shortName: "Intl Econ", desc: "Budget-friendly international shipping", minDays: 14, maxDays: 20, cost: "$18.00" },
  ],
  tcs: [
    { id: "tcs-overnight", name: "TCS Overnight", shortName: "Overnight", desc: "Next-day delivery within country", minDays: 1, maxDays: 1, cost: "$5.00", isDefault: true },
    { id: "tcs-detain", name: "TCS Detain", shortName: "Detain", desc: "Hold at destination for pickup", minDays: 2, maxDays: 3, cost: "$3.50" },
  ],
  dhl: [
    { id: "dhl-express", name: "DHL Express Worldwide", shortName: "Air", desc: "Door-to-door international express", minDays: 1, maxDays: 3, cost: "$38.00", isDefault: true },
    { id: "dhl-ecommerce", name: "DHL eCommerce", shortName: "Ecommerce", desc: "Lightweight parcel delivery", minDays: 5, maxDays: 10, cost: "$9.50" },
    { id: "dhl-freight", name: "DHL Freight", shortName: "Freight", desc: "Road & rail freight forwarding", minDays: 7, maxDays: 14, cost: "$24.00" },
  ],
  ups: [
    { id: "ups-next-day", name: "UPS Next Day Air", shortName: "Air", desc: "Guaranteed next business day", minDays: 1, maxDays: 1, cost: "$42.00", isDefault: true },
    { id: "ups-ground", name: "UPS Ground", shortName: "Ground", desc: "Reliable ground shipping", minDays: 5, maxDays: 7, cost: "$15.00" },
    { id: "ups-worldwide", name: "UPS Worldwide Economy", shortName: "Worldwide", desc: "Most economical international option", minDays: 3, maxDays: 12, cost: "$28.00" },
  ],
  sf: [
    { id: "sf-standard", name: "SF Standard Express", shortName: "Standard", desc: "Standard domestic delivery", minDays: 2, maxDays: 4, cost: "$8.00", isDefault: true },
    { id: "sf-international", name: "SF International", shortName: "Intl", desc: "Cross-border parcel delivery", minDays: 5, maxDays: 10, cost: "$22.00" },
  ],
  usps: [
    { id: "usps-priority", name: "USPS Priority Mail", shortName: "Priority", desc: "Fast domestic delivery with tracking", minDays: 1, maxDays: 3, cost: "$9.00", isDefault: true },
    { id: "usps-ground-adv", name: "USPS Ground Advantage", shortName: "Ground", desc: "Affordable ground delivery", minDays: 2, maxDays: 5, cost: "$5.50" },
  ],
  aramex: [
    { id: "aramex-express", name: "Aramex Priority Express", shortName: "Air", desc: "Time-definite international express", minDays: 1, maxDays: 3, cost: "$28.00", isDefault: true },
    { id: "aramex-domestic", name: "Aramex Domestic Express", shortName: "Domestic", desc: "Fast local delivery", minDays: 1, maxDays: 2, cost: "$9.00" },
  ],
  maersk: [
    { id: "maersk-ocean", name: "Maersk Ocean Freight", shortName: "Sea", desc: "Full container sea freight", minDays: 20, maxDays: 45, cost: "$6.50", isDefault: true },
    { id: "maersk-air", name: "Maersk Air Freight", shortName: "Air", desc: "Air cargo forwarding", minDays: 3, maxDays: 7, cost: "$32.00" },
  ],
};

export interface ShippingCarrierEntry {
  id: string;
  carrier: string;
  methods: string;
  isDefault: boolean;
  primaryMethod: string;
}

/* Shared "configured shipping method" card.
   Visual mirrors the Add Carrier picker grid (logo + name/desc, status,
   Primary star, hero price + days, method tier chips, rating·shipments
   strip) so creation forms and the picker share one consistent visual.
   Method chips behave as TIER selectors (like pricing-rule cards) —
   clicking a chip swaps which method is shown in the hero metric. */
export function ShippingMethodCarrierCard({
  entry,
  carrierCatalog = SHIPPING_CARRIER_CATALOG,
  carrierMethods = SHIPPING_CARRIER_METHODS,
  inherited = false,
  onEdit,
  onRemove,
  onSetPrimary,
}: {
  entry: ShippingCarrierEntry;
  carrierCatalog?: CarrierCatalogEntry[];
  carrierMethods?: Record<string, CarrierMethodEntry[]>;
  /** Marks the card as inherited from a parent context (e.g. partner →
   *  location). Renders a small "Inherited" pill in the top row alongside
   *  the Carrier · Methods chip so consumers don't need to overlay one. */
  inherited?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSetPrimary: () => void;
}) {
  const carrier = carrierCatalog.find((c) => c.id === entry.carrier);
  const allMethods = entry.carrier ? carrierMethods[entry.carrier] || [] : [];
  const selectedIds = entry.methods ? entry.methods.split(",").filter(Boolean) : [];
  const selectedMethods = allMethods.filter((m) => selectedIds.includes(m.id));
  const primaryIdx = Math.max(0, selectedMethods.findIndex((m) => m.id === entry.primaryMethod));
  const [activeIdx, setActiveIdx] = useState(primaryIdx);
  const safeIdx = Math.min(activeIdx, Math.max(0, selectedMethods.length - 1));
  const heroMethod = selectedMethods[safeIdx];

  const status = carrier?.status || "Active";
  const statusStyle =
    status === "Active"
      ? { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" }
      : status === "Under Review"
        ? { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" }
        : { bg: "hsl(var(--muted))", color: "#64748B", border: "hsl(var(--border))" };

  // Primary cards get the same blue outline + soft shadow as
  // the canonical PaymentMethodCard so the active default
  // carrier reads at-a-glance across every surface this card
  // shows up on (creation form, partner group, partner detail).
  const isPrimary = entry.isDefault;
  const primaryBorder = "#0A77FF66"; // primary/40
  const primaryShadow = "0 2px 12px -4px rgba(10,119,255,0.12)";
  const primaryHoverShadow = "0 4px 20px -4px rgba(10,119,255,0.18)";
  return (
    <div
      onClick={onEdit}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative h-full ${
        isPrimary ? "border-[1.5px]" : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      }`}
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
          e.currentTarget.style.borderColor = "hsl(var(--border))";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
        }
      }}
    >
      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: "Carrier · N Methods" combined pill (left)
            + Active/Inactive pill + Primary star/badge (right).
            Mirrors the canonical partner-detail CarrierShippingCard
            so the same card visual travels across creation form,
            partner group config, and partner detail page. */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-stretch rounded-full overflow-hidden border border-blue-200 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-blue-800 bg-blue-50" style={{ fontWeight: 600 }}>
                <Truck className="w-3 h-3" /> Carrier
              </span>
              <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-blue-200" style={{ fontWeight: 500 }}>
                {selectedMethods.length} Method{selectedMethods.length !== 1 ? "s" : ""}
              </span>
            </span>
            {inherited && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF] shrink-0 whitespace-nowrap"
                style={{ fontWeight: 600 }}
                title="Inherited from partner default"
              >
                <Check className="w-2.5 h-2.5" /> Inherited
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {entry.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border border-blue-200 bg-blue-50 text-blue-800" style={{ fontWeight: 600 }}>
                <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
                Primary
              </span>
            )}
            {!entry.isDefault && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetPrimary(); }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                title="Set as primary"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap" style={{ fontWeight: 500, backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: statusStyle.border }}>
              {status}
            </span>
          </div>
        </div>

        {/* Row 2: Carrier name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{carrier ? carrier.name : "Unknown Carrier"}</p>
        </div>

        {/* Row 3: Description — fixed 2-line height to keep grid
            cells uniform regardless of description length. */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>
            {carrier?.desc || ""}
          </p>
        </div>

        {/* The hero $X.XX / shipment row was removed per stakeholder
            feedback — real shipping pricing depends on weight, lane,
            packaging, etc., so a static per-shipment number on the
            card was misleading. Days now live next to the method
            name in the bottom strip. */}

        {/* Row 4: Method tier chips — only shown when more than one
            method is selected (single-method cards stay clean). */}
        {selectedMethods.length > 1 && (
          <div className="pt-2 shrink-0">
            <div className="flex items-center gap-1 flex-wrap">
              {selectedMethods.map((m, idx) => {
                const isActive = idx === safeIdx;
                const isPrimaryMethod = m.id === entry.primaryMethod;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
                    className={`px-2 py-[3px] rounded-md text-[10px] transition-all cursor-pointer ${isActive ? "shadow-sm" : "hover:bg-border"}`}
                    style={{ fontWeight: isActive ? 600 : 500, backgroundColor: isActive ? "#EFF6FF" : "hsl(var(--muted))", color: isActive ? "hsl(var(--primary))" : "#64748B", boxShadow: isActive ? "0 0 0 1px #0A77FF30" : undefined }}
                  >
                    <span className="inline-flex items-center gap-1">{m.shortName}{isPrimaryMethod && <Star className="w-2.5 h-2.5 text-primary fill-primary" />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 5: Active method detail strip — service name on the
            left, transit window of the active method chip on the
            right. (Cost was dropped from this strip too.) */}
        {heroMethod && (
          <div className="mt-auto pt-2 shrink-0">
            <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
              <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                <Package className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate" style={{ fontWeight: 400 }}>{heroMethod.name}</span>
              </div>
              <span className="shrink-0 ml-2 inline-flex items-center gap-1 text-slate-500" style={{ fontWeight: 600 }}>
                <Clock className="w-3 h-3 text-slate-400" />
                {heroMethod.minDays === heroMethod.maxDays
                  ? `${heroMethod.minDays} day${heroMethod.minDays !== 1 ? "s" : ""}`
                  : `${heroMethod.minDays}–${heroMethod.maxDays} days`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hover-only remove */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
        title="Remove"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
