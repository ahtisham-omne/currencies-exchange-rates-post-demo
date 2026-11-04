/* ═══════════════════════════════════════════════════════════════
   VendorSelector — Popover-based vendor selector for catalog items
   
   Scalable design: compact vendor rows + search + expandable
   detail panel. Works for 3 or 2500 vendors.
   
   Used on catalog cards, OrderFlow, and anywhere a vendor name
   appears to allow switching vendors (affects price).
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from "react";
import {
  MapPin,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Building2,
  Search,
  X,
  Plus,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import { Badge } from "./ui/badge";
import type { ItemVendorOffer } from "./catalogData";
import { getVendorCurrency } from "./catalogData";
import { CurrencyAmount } from "./ui/CurrencyAmount";
import { BASE_CURRENCY, convertToBase } from "@/app/data/currencyLibrary";
import { FONT } from "./designTokens";

/* ── Typography tokens (CSS variable bound, Inter only) ── */

const st = {
  vendorName: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,
  priceLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  tiny: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  uiSmall: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  uiLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  triggerVendor: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/**
 * Render a vendor offer's unit price honoring the modal-level Base ↔ Partner
 * toggle. When `viewMode === "partner"` the offer's native quote is shown
 * primary with a base-currency hover; when `viewMode === "base"` the base
 * equivalent is primary with the native quote on hover. Unspecified defaults
 * to "base" so existing callers (catalog cards, post-checkout summaries) keep
 * the global currency rule's default.
 */
function VendorOfferPrice({
  vendorName,
  nativePrice,
  viewMode = "base",
  inputIsPKR = false,
  className,
}: {
  vendorName: string;
  /** Either the vendor's native quote OR a PKR-equivalent — toggled via `inputIsPKR`. */
  nativePrice: number;
  viewMode?: "base" | "partner";
  /** Set when the caller has already converted unit prices to PKR (e.g. PO edit flows). */
  inputIsPKR?: boolean;
  className?: string;
}) {
  const vendorCurrency = (getVendorCurrency(vendorName) ?? BASE_CURRENCY).toUpperCase();
  const isVendorBase = vendorCurrency === BASE_CURRENCY;
  const effectiveMode: "base" | "partner" = isVendorBase ? "base" : viewMode;

  // Resolve both base and partner values from whichever the caller supplied.
  const basePKR = inputIsPKR ? nativePrice : convertToBase(nativePrice, vendorCurrency);
  const partnerValue = inputIsPKR
    ? (isVendorBase ? nativePrice : convertToBase(nativePrice, vendorCurrency) / convertToBase(1, vendorCurrency))
    : nativePrice;
  // Note: `convertToBase(1, vendorCurrency)` is the rate; dividing PKR by it yields the native value.
  // Using the rate directly avoids importing convertBetween here.
  const nativeValue = inputIsPKR && !isVendorBase
    ? nativePrice / (convertToBase(1, vendorCurrency) || 1)
    : partnerValue;

  if (effectiveMode === "partner") {
    return (
      <CurrencyAmount
        mode="listing-partner"
        currency={vendorCurrency}
        value={nativeValue}
        className={className}
      />
    );
  }
  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={basePKR}
      partnerDefaultCurrency={vendorCurrency}
      partnerDefaultValue={nativeValue}
      className={className}
    />
  );
}

/* ── Priority badge colors ── */
function getPriorityBadge(priority: string) {
  if (priority === "default") {
    return { label: "Default", className: "border-primary/30 text-primary bg-primary/5" };
  }
  const num = parseInt(priority, 10);
  const ordinal = num === 2 ? "2nd" : num === 3 ? "3rd" : `${num}th`;
  if (num === 2) {
    return { label: `${ordinal}`, className: "border-chart-3/30 text-chart-3 bg-chart-3/5" };
  }
  return { label: `${ordinal}`, className: "border-foreground/15 text-foreground/50 bg-secondary" };
}

/** Shorten a long vendor name for display */
function shortVendorName(name: string) {
  return name
    .replace(/ \(.*\)$/, "")
    .replace(", Inc.", "")
    .replace(", Ltd. (USA)", "")
    .replace(" N.V.", "");
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR SELECTOR — Main exported component
   
   Props:
   - offers: ItemVendorOffer[] — all available vendor offers
   - selectedVendor: string — current vendor name
   - onSelectVendor: callback when vendor changes
   - variant: "card" | "inline" | "compact" — display mode
   ═══════════════════════════════════════════════════════════════ */

export interface VendorSelectorProps {
  offers: ItemVendorOffer[];
  selectedVendor: string;
  onSelectVendor: (offer: ItemVendorOffer) => void;
  variant?: "card" | "inline" | "compact";
  onAddNewVendor?: () => void;
  /**
   * When the host shell exposes a Base ↔ Partner currency toggle (e.g. the
   * Item Detail modal in OrderFlow), pass it through so the prices in this
   * dropdown honor the same view. Defaults to "base" — the global rule.
   */
  viewMode?: "base" | "partner";
  /**
   * Set when the supplied `offer.unitPrice` values are already PKR-equivalent
   * (e.g. when the modal hosts an existing PO line item). Catalog-sourced
   * flows leave this false — the offer's native quote is used as-is.
   */
  inputIsPKR?: boolean;
}

export default function VendorSelector({
  offers,
  selectedVendor,
  onSelectVendor,
  variant = "inline",
  onAddNewVendor,
  viewMode = "base",
  inputIsPKR = false,
}: VendorSelectorProps) {
  const [open, setOpen] = useState(false);

  if (!offers || offers.length === 0) return null;

  const currentOffer = offers.find((o) => o.vendorName === selectedVendor) || offers[0];
  const hasMultipleVendors = offers.length > 1;

  const handleSelect = (offer: ItemVendorOffer) => {
    onSelectVendor(offer);
    setOpen(false);
  };

  const handleAddNewVendor = onAddNewVendor ? () => {
    setOpen(false);
    onAddNewVendor();
  } : undefined;

  /* ── CARD variant: bordered dropdown-style trigger for catalog cards ── */
  if (variant === "card") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1.5 w-full min-w-0 px-2 py-1.5 rounded-[var(--radius-md)] border transition-all cursor-pointer group/vendor ${
              open
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10"
                : hasMultipleVendors
                ? "border-border hover:border-primary/30 hover:bg-primary/3"
                : "border-border"
            }`}
            style={{ backgroundColor: open ? undefined : "var(--card)" }}
            onClick={(e) => {
              if (!hasMultipleVendors) return;
              e.stopPropagation();
            }}
            disabled={!hasMultipleVendors}
          >
            <Building2 className={`size-3 shrink-0 ${open ? "text-primary" : "text-foreground/30"}`} />
            <span
              className={`truncate flex-1 text-left ${
                open ? "text-primary" : hasMultipleVendors ? "text-foreground/70 group-hover/vendor:text-foreground" : "text-foreground/50"
              }`}
              style={st.triggerVendor}
            >
              {shortVendorName(currentOffer.vendorName)}
            </span>
            {hasMultipleVendors && (
              <>
                <span
                  className={`inline-flex items-center justify-center rounded-full min-w-[16px] h-[14px] px-1 shrink-0 ${
                    open ? "bg-primary/15 text-primary" : "bg-secondary text-foreground/40"
                  }`}
                  style={st.tiny}
                >
                  {offers.length}
                </span>
                <ChevronDown className={`size-3 shrink-0 transition-transform ${
                  open ? "text-primary rotate-180" : "text-foreground/30"
                }`} />
              </>
            )}
          </button>
        </PopoverTrigger>

        {hasMultipleVendors && (
          <PopoverContent
            className="w-[400px] p-0 border-border"
            style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
            align="start"
            sideOffset={8}
          >
            <VendorSelectorContent
              offers={offers}
              selectedVendor={selectedVendor}
              onSelect={handleSelect}
              onAddNewVendor={handleAddNewVendor}
              viewMode={viewMode}
              inputIsPKR={inputIsPKR}
            />
          </PopoverContent>
        )}
      </Popover>
    );
  }

  /* ── COMPACT variant: minimal chip ── */
  if (variant === "compact") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
            style={{ backgroundColor: "var(--secondary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center size-5 rounded-full bg-primary/8 shrink-0">
              <span className="text-primary" style={{ ...st.tiny, fontSize: "8px" }}>
                {currentOffer.abbr}
              </span>
            </div>
            <span className="text-foreground truncate max-w-[120px]" style={st.triggerVendor}>
              {shortVendorName(currentOffer.vendorName)}
            </span>
            {hasMultipleVendors && (
              <ChevronDown className="size-3 text-foreground/30 shrink-0" />
            )}
          </button>
        </PopoverTrigger>

        {hasMultipleVendors && (
          <PopoverContent
            className="w-[400px] p-0 border-border"
            style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
            align="start"
            sideOffset={8}
          >
            <VendorSelectorContent
              offers={offers}
              selectedVendor={selectedVendor}
              onSelect={handleSelect}
              onAddNewVendor={handleAddNewVendor}
              viewMode={viewMode}
              inputIsPKR={inputIsPKR}
            />
          </PopoverContent>
        )}
      </Popover>
    );
  }

  /* ── INLINE variant: full trigger button (for OrderFlow) ── */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-2.5 w-full p-3 rounded-[var(--radius-md)] border transition-all cursor-pointer text-left ${
            hasMultipleVendors
              ? "border-border hover:border-primary/30 hover:shadow-[var(--elevation-sm)]"
              : "border-border"
          }`}
          style={{ backgroundColor: "var(--card)" }}
          onClick={(e) => {
            if (!hasMultipleVendors) { e.preventDefault(); return; }
            e.stopPropagation();
          }}
          disabled={!hasMultipleVendors}
        >
          <div className="flex items-center justify-center size-9 rounded-full bg-primary/8 border border-primary/15 shrink-0">
            <span className="text-primary" style={{ ...st.uiLabel, fontSize: "12px" }}>
              {currentOffer.abbr}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-foreground truncate" style={st.vendorName}>
                {currentOffer.vendorName}
              </span>
              {currentOffer.isDefault && (
                <Badge
                  variant="outline"
                  className="rounded-[var(--radius-sm)] px-1.5 py-0 border-primary/30 text-primary bg-primary/5 shrink-0"
                  style={st.tiny}
                >
                  Default
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-primary inline-flex items-baseline gap-0.5" style={st.priceLabel}>
                <VendorOfferPrice
                  vendorName={currentOffer.vendorName}
                  nativePrice={currentOffer.unitPrice}
                  viewMode={viewMode}
                  inputIsPKR={inputIsPKR}
                />
                <span className="text-primary/80">/ {currentOffer.defaultUOM}</span>
              </span>
              {hasMultipleVendors && (
                <span className="text-foreground/30" style={st.uiSmall}>
                  · {offers.length} vendors available
                </span>
              )}
            </div>
          </div>
          {hasMultipleVendors && (
            <ChevronDown className="size-4 text-foreground/30 shrink-0" />
          )}
        </button>
      </PopoverTrigger>

      {hasMultipleVendors && (
        <PopoverContent
          className="w-[400px] p-0 border-border"
          style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
          align="start"
          sideOffset={8}
        >
          <VendorSelectorContent
            offers={offers}
            selectedVendor={selectedVendor}
            onSelect={handleSelect}
            onAddNewVendor={handleAddNewVendor}
            viewMode={viewMode}
            inputIsPKR={inputIsPKR}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR SELECTOR CONTENT — Shared popover content
   ═══════════════════════════════════════════════════════════════ */

export function VendorSelectorContent({
  offers,
  selectedVendor,
  onSelect,
  hidePrice = false,
  assignedVendors = [],
  onAssignAnother,
  onAddNewVendor,
  viewMode = "base",
  inputIsPKR = false,
}: {
  offers: ItemVendorOffer[];
  selectedVendor: string;
  onSelect: (offer: ItemVendorOffer) => void;
  hidePrice?: boolean;
  assignedVendors?: string[];
  /** When provided, shows a "+ Assign Another Vendor" action at the bottom of the list */
  onAssignAnother?: () => void;
  /** When provided, shows a "+ Add New Vendor" action at the bottom of the list */
  onAddNewVendor?: () => void;
  /** Mirror of the host shell's currency toggle. Default: base. */
  viewMode?: "base" | "partner";
  /** Set when the supplied `offer.unitPrice` values are already PKR-equivalent. */
  inputIsPKR?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [detailVendor, setDetailVendor] = useState<string | null>(null);

  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offers;
    const q = searchQuery.toLowerCase();
    return offers.filter(
      (o) =>
        o.vendorName.toLowerCase().includes(q) ||
        o.abbr.toLowerCase().includes(q) ||
        o.contact.name.toLowerCase().includes(q) ||
        o.locations.some(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.address.toLowerCase().includes(q)
        )
    );
  }, [offers, searchQuery]);

  const showSearch = offers.length > 4;

  return (
    <div
      className="flex flex-col"
      style={{ fontFamily: FONT, maxHeight: "min(560px, 80vh)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] bg-primary/8 shrink-0">
          <Building2 className="size-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-foreground block" style={st.vendorName}>
            Select Vendor
          </span>
          <span className="text-muted-foreground block" style={st.uiSmall}>
            {offers.length} vendor{offers.length !== 1 ? "s" : ""} available for
            this item
          </span>
        </div>
      </div>

      {/* ── Search (shown when >5 vendors) ── */}
      {showSearch && (
        <div className="px-3 pt-2.5 pb-1.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors..."
              className="w-full h-8 rounded-[var(--radius-md)] border border-border pl-8 pr-8 text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-ring/15"
              style={{
                ...st.uiSmall,
                backgroundColor: "var(--input-background)",
                fontFamily: FONT,
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground cursor-pointer transition-colors"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Compact vendor list ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex flex-col py-1">
          {filteredOffers.map((offer) => {
            const isSelected = offer.vendorName === selectedVendor;
            const isDetailOpen = detailVendor === offer.vendorName;
            const badge = getPriorityBadge(offer.priority);

            return (
              <div key={offer.vendorName}>
                {/* ── Compact row ── */}
                <div
                  className={`group flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-[var(--radius-md)] cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/5 ring-1 ring-inset ring-primary/15"
                      : "hover:bg-secondary/70"
                  }`}
                  onClick={() => onSelect(offer)}
                >
                  {/* Avatar */}
                  <div
                    className={`flex items-center justify-center size-8 rounded-full shrink-0 border ${
                      isSelected
                        ? "bg-primary/10 border-primary/20"
                        : "bg-secondary border-border"
                    }`}
                  >
                    <span
                      className={
                        isSelected ? "text-primary" : "text-foreground/45"
                      }
                      style={{
                        fontSize: "11px",
                        fontWeight: "var(--font-weight-semibold)",
                        fontFamily: FONT,
                      }}
                    >
                      {offer.abbr}
                    </span>
                  </div>

                  {/* Name + badge + price */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-foreground truncate"
                        style={{
                          fontSize: "13px",
                          fontWeight: "var(--font-weight-semibold)",
                          lineHeight: "1.35",
                          fontFamily: FONT,
                        }}
                      >
                        {shortVendorName(offer.vendorName)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`rounded-[var(--radius-sm)] px-1 py-0 shrink-0 ${badge.className}`}
                        style={{
                          fontSize: "9px",
                          fontWeight: "var(--font-weight-medium)",
                          fontFamily: FONT,
                          lineHeight: "1.3",
                        }}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                    {!hidePrice || offer.unitPrice > 0 ? (
                      offer.unitPrice > 0 ? (
                        <span
                          className="text-primary inline-flex items-baseline gap-1"
                          style={{
                            fontSize: "11px",
                            fontWeight: "var(--font-weight-semibold)",
                            lineHeight: "1.35",
                            fontFamily: FONT,
                          }}
                        >
                          <VendorOfferPrice
                            vendorName={offer.vendorName}
                            nativePrice={offer.unitPrice}
                            viewMode={viewMode}
                            inputIsPKR={inputIsPKR}
                          />
                          <span className="text-primary/80">/ {offer.defaultUOM}</span>
                          {offer.discount > 0 && (
                            <span
                              className="text-accent ml-1.5"
                              style={{
                                fontSize: "10px",
                                fontWeight: "var(--font-weight-medium)",
                                fontFamily: FONT,
                              }}
                            >
                              {offer.discount}% off
                            </span>
                          )}
                        </span>
                      ) : null
                    ) : assignedVendors.includes(offer.vendorName) ? (
                      <span
                        className="text-muted-foreground block"
                        style={{
                          fontSize: "10px",
                          fontWeight: "var(--font-weight-medium)",
                          lineHeight: "1.35",
                          fontFamily: FONT,
                        }}
                      >
                        Assigned
                      </span>
                    ) : null}
                  </div>

                  {/* Detail toggle + select/selected label + check */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected ? (
                      <span className="text-primary text-xs" style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                        <Check className="size-3 inline -mt-0.5 mr-0.5" />Selected
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 group-hover:text-primary text-xs transition-colors duration-150" style={{ fontSize: "9px", fontFamily: FONT }}>
                        Select
                      </span>
                    )}
                    <button
                      className="flex items-center justify-center size-6 rounded-[var(--radius-sm)] hover:bg-foreground/5 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailVendor(
                          isDetailOpen ? null : offer.vendorName
                        );
                      }}
                      title="View details"
                    >
                      {isDetailOpen ? (
                        <ChevronUp className="size-3.5 text-primary" />
                      ) : (
                        <ChevronDown className="size-3.5 text-foreground/30" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Expanded detail panel (only for toggled vendor) ── */}
                {isDetailOpen && (
                  <div
                    className="mx-3 mb-1 rounded-b-[var(--radius-md)] border border-t-0 border-border overflow-hidden"
                    style={{ backgroundColor: "var(--secondary)" }}
                  >
                    {!hidePrice && (
                      <>
                        {/* Price highlight */}
                        <div className="px-3 pt-2.5 pb-2">
                          <span
                            className="text-primary inline-flex items-baseline gap-1"
                            style={{
                              fontSize: "12px",
                              fontWeight: "var(--font-weight-semibold)",
                              fontFamily: FONT,
                              lineHeight: "1.4",
                            }}
                          >
                            <span className="text-foreground/60" style={{ fontWeight: "var(--font-weight-normal)" }}>Price per unit :</span>
                            <VendorOfferPrice
                              vendorName={offer.vendorName}
                              nativePrice={offer.unitPrice}
                              viewMode={viewMode}
                              inputIsPKR={inputIsPKR}
                            />
                            <span className="text-primary/80">/ {offer.defaultUOM} ({offer.defaultUOM})</span>
                          </span>
                        </div>

                        <div
                          className="h-px mx-3"
                          style={{ backgroundColor: "var(--border)" }}
                        />
                      </>
                    )}

                    {/* Location section */}
                    <div className="px-3 pt-2 pb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="size-3 text-primary/60" />
                        <span
                          className="text-foreground/50"
                          style={{
                            fontSize: "10px",
                            fontWeight: "var(--font-weight-semibold)",
                            fontFamily: FONT,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase" as const,
                          }}
                        >
                          Locations ({offer.locations.length})
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {offer.locations.map((loc, locIdx) => (
                          <div
                            key={locIdx}
                            className={`flex items-start gap-2 py-1 px-2 rounded-[var(--radius-sm)] ${loc.isDefault ? "bg-primary/[0.04]" : ""}`}
                          >
                            <MapPin className="size-3 text-foreground/25 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-foreground truncate"
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "var(--font-weight-medium)",
                                    fontFamily: FONT,
                                    lineHeight: "1.35",
                                  }}
                                >
                                  {loc.name}
                                </span>
                                {loc.isDefault && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-[var(--radius-sm)] px-1 py-0 border-primary/30 text-primary bg-primary/5"
                                    style={{
                                      fontSize: "9px",
                                      fontWeight: "var(--font-weight-medium)",
                                      fontFamily: FONT,
                                      lineHeight: "1.3",
                                    }}
                                  >
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <span
                                className="text-foreground/40 block truncate"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "var(--font-weight-normal)",
                                  fontFamily: FONT,
                                  lineHeight: "1.35",
                                }}
                              >
                                {loc.address}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="h-px mx-3"
                      style={{ backgroundColor: "var(--border)" }}
                    />

                    {/* Contact section */}
                    <div className="px-3 pt-2 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center size-6 rounded-[var(--radius-sm)] bg-card shrink-0">
                          <span
                            className="text-foreground/40"
                            style={{
                              fontSize: "9px",
                              fontWeight: "var(--font-weight-medium)",
                              fontFamily: FONT,
                            }}
                          >
                            {offer.contact.initials}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-foreground block truncate"
                            style={{
                              fontSize: "12px",
                              fontWeight: "var(--font-weight-semibold)",
                              fontFamily: FONT,
                              lineHeight: "1.35",
                            }}
                          >
                            {offer.contact.name}
                          </span>
                          <span
                            className="text-foreground/40 block truncate"
                            style={{
                              fontSize: "10px",
                              fontWeight: "var(--font-weight-normal)",
                              fontFamily: FONT,
                              lineHeight: "1.35",
                            }}
                          >
                            {offer.contact.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 pl-8 flex-wrap">
                        <div className="flex items-center gap-1 min-w-0">
                          <Phone className="size-2.5 text-foreground/15 shrink-0" />
                          <span
                            className="text-foreground/45 truncate"
                            style={{
                              fontSize: "10px",
                              fontWeight: "var(--font-weight-normal)",
                              fontFamily: FONT,
                            }}
                          >
                            {offer.contact.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <Mail className="size-2.5 text-foreground/15 shrink-0" />
                          <span
                            className="text-foreground/45 truncate"
                            style={{
                              fontSize: "10px",
                              fontWeight: "var(--font-weight-normal)",
                              fontFamily: FONT,
                            }}
                          >
                            {offer.contact.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty search state */}
          {filteredOffers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 px-4">
              <Search className="size-4 text-foreground/15" />
              <span
                className="text-foreground/30 text-center"
                style={st.uiSmall}
              >
                No vendors match "{searchQuery}"
              </span>
              <button
                className="text-primary cursor-pointer hover:underline"
                style={st.uiSmall}
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            </div>
          )}

          {/* + Assign Another Vendor action (inside dropdown) */}
          {onAssignAnother && !searchQuery && (
            <div className="border-t border-border mx-1.5 mt-1">
              <button
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer transition-all hover:bg-primary/5 text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignAnother();
                }}
              >
                <div className="flex items-center justify-center size-8 rounded-full shrink-0 border border-dashed border-primary/30 bg-primary/5">
                  <span className="text-primary" style={{ fontSize: "16px", lineHeight: "1" }}>+</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                  Assign Another Vendor
                </span>
              </button>
            </div>
          )}

          {/* + Add New Vendor action (F15) */}
          {onAddNewVendor && !searchQuery && (
            <div className={`border-t border-border mx-1.5 ${!onAssignAnother ? 'mt-1' : ''}`}>
              <button
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer transition-all hover:bg-primary/5 text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNewVendor();
                }}
              >
                <div className="flex items-center justify-center size-8 rounded-full shrink-0 border border-dashed border-primary/30 bg-primary/5">
                  <Plus className="size-3.5 text-primary" />
                </div>
                <span style={{ fontSize: "13px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                  Add New Vendor
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: result count ── */}
      {showSearch && filteredOffers.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-border">
          <span className="text-foreground/30" style={st.uiSmall}>
            Showing {filteredOffers.length} of {offers.length} vendor
            {offers.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
