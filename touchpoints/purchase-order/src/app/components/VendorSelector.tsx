/* ═══════════════════════════════════════════════════════════════
   VendorSelector — Popover-based vendor selector for catalog items
   
   Scalable design: compact vendor rows + search + expandable
   detail panel. Works for 3 or 2500 vendors.
   
   Used on catalog cards, OrderFlow, and anywhere a vendor name
   appears to allow switching vendors (affects price).
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useRef } from "react";
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
  AlertTriangle,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import { Badge } from "./ui/badge";
import type { ItemVendorOffer } from "./catalogData";
import { FONT } from "./designTokens";
import { getAvatarTint } from "./avatarTints";
import PartnerHoverCard, { type PartnerHoverCardVendor } from "./PartnerHoverCard";

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
  /** Optional external hook — fires when the buyer picks a location
   *  inside the details popover so the parent (e.g. OrderFlow) can
   *  persist the choice onto the PO (ship-to, delivery address, …). */
  onLocationChange?: (vendorName: string, locationName: string) => void;
  /** Optional controlled map of vendor → picked location. When
   *  provided the wrapper becomes fully controlled — the parent owns
   *  the state and can commit a location externally (e.g. after a
   *  qualify prompt). */
  selectedLocationByVendor?: Record<string, string>;
  /** Returns true if the (vendor, location) pair is qualified for the
   *  current item. When it returns false the row renders a warning
   *  indicator and click routes to `onLocationNeedsQualification`
   *  instead of committing (buyer 2026-07-30). Default (no prop) =
   *  every location is qualified. */
  isLocationQualified?: (vendorName: string, locationName: string) => boolean;
  /** Fires when the buyer clicks a non-qualified location. The parent
   *  should open a scope prompt and, on accept, add the pair to its
   *  qualified set + commit the location change. */
  onLocationNeedsQualification?: (vendorName: string, locationName: string) => void;
}

export default function VendorSelector({
  offers,
  selectedVendor,
  onSelectVendor,
  variant = "inline",
  onAddNewVendor,
  onLocationChange,
  selectedLocationByVendor,
  isLocationQualified,
  onLocationNeedsQualification,
}: VendorSelectorProps) {
  const [open, setOpen] = useState(false);
  /* Track the buyer's per-vendor location pick at the top level so the
     trigger card (below) can reflect it live — otherwise the header
     always shows the vendor's default location even after the buyer
     switched to a different one inside the popover. Falls back to
     internal state when the parent isn't controlling it. */
  const [internalLocByVendor, setInternalLocByVendor] = useState<
    Record<string, string>
  >({});
  const selectedLocByVendor = selectedLocationByVendor ?? internalLocByVendor;
  const handleLocationChange = (vendorName: string, locationName: string) => {
    if (!selectedLocationByVendor) {
      setInternalLocByVendor((prev) => ({ ...prev, [vendorName]: locationName }));
    }
    if (onLocationChange) onLocationChange(vendorName, locationName);
  };
  /* Wrap the parent's qualify callback so the outer vendor picker
     collapses BEFORE the modal opens — otherwise the picker's high
     z-index (`z-[9999]`) sits on top of the AlertDialog and hides it
     (buyer 2026-07-30). */
  const handleLocationNeedsQualification = onLocationNeedsQualification
    ? (vendorName: string, locationName: string) => {
        setOpen(false);
        onLocationNeedsQualification(vendorName, locationName);
      }
    : undefined;

  /* Shared outside-click guard used on every Radix PopoverContent
     wrapping the vendor list — the details popover (which lives in a
     body-mounted `createPortal`) is DOM-detached from PopoverContent,
     so Radix's DismissableLayer treats clicks in it as "outside" and
     collapses the vendor list. Reading `event.detail.originalEvent`
     (Radix's CustomEvent shape) lets us detect the true click target
     and preventDefault when it lives inside the details portal. */
  const guardVendorPopoverDismiss = (event: Event) => {
    const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail;
    const originalTarget = (detail?.originalEvent?.target ?? event.target) as
      | HTMLElement
      | null;
    if (originalTarget?.closest?.("[data-vendor-detail-popover]")) {
      event.preventDefault();
    }
  };

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
            style={{ backgroundColor: open ? undefined : "hsl(var(--card))" }}
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
            className="w-auto max-w-[calc(100vw-16px)] p-0 border-border overflow-hidden"
            style={{
              fontFamily: FONT,
              backgroundColor: "hsl(var(--card))",
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
            }}
            align="start"
            sideOffset={8}
            onInteractOutside={guardVendorPopoverDismiss}
            onPointerDownOutside={guardVendorPopoverDismiss}
            onFocusOutside={guardVendorPopoverDismiss}
          >
            <VendorSelectorContent
              offers={offers}
              selectedVendor={selectedVendor}
              onSelect={handleSelect}
              onAddNewVendor={handleAddNewVendor}
              selectedLocationByVendor={selectedLocByVendor}
              onLocationChange={handleLocationChange}
              isLocationQualified={isLocationQualified}
              onLocationNeedsQualification={handleLocationNeedsQualification}
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
            style={{ backgroundColor: "hsl(var(--secondary))" }}
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
            className="w-auto max-w-[calc(100vw-16px)] p-0 border-border overflow-hidden"
            style={{
              fontFamily: FONT,
              backgroundColor: "hsl(var(--card))",
              /* Elevated floating panel — mirrors Partners' address-
                 autocomplete recipe (buyer 2026-07-30). Two-layer
                 stack: close soft ambient + wide diffuse. Same
                 elevation whether the detail column is open or not
                 so the pair reads as one card. */
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
            }}
            align="start"
            sideOffset={8}
            onInteractOutside={guardVendorPopoverDismiss}
            onPointerDownOutside={guardVendorPopoverDismiss}
            onFocusOutside={guardVendorPopoverDismiss}
          >
            <VendorSelectorContent
              offers={offers}
              selectedVendor={selectedVendor}
              onSelect={handleSelect}
              onAddNewVendor={handleAddNewVendor}
              selectedLocationByVendor={selectedLocByVendor}
              onLocationChange={handleLocationChange}
              isLocationQualified={isLocationQualified}
              onLocationNeedsQualification={handleLocationNeedsQualification}
            />
          </PopoverContent>
        )}
      </Popover>
    );
  }

  /* ── INLINE variant: full trigger button (for OrderFlow) ──
     Partners-aligned: squircle avatar with hash tint + hover card, a
     stacked location row (MapPin + selected location + address) so the
     card carries the same three sections the details popover shows
     (identity, price, location) — future sections slot in below with
     the same `mt-1.5` rhythm. */
  /* Trigger card's location line — prefers the buyer's explicit pick
     (from the details popover) and falls back to the vendor's default
     location. Reads from the same top-level `selectedLocByVendor`
     state that the popover writes to, so the trigger updates live.
     `triggerIsDirect` handles the "Direct to vendor" sentinel row
     (see VendorSelector.tsx:1204). */
  const triggerPickedName = selectedLocByVendor[currentOffer.vendorName];
  const triggerIsDirect = triggerPickedName === "__direct__";
  const triggerDefaultLoc = (() => {
    if (triggerIsDirect) return null;
    if (triggerPickedName) {
      const picked = currentOffer.locations.find((l) => l.name === triggerPickedName);
      if (picked) return picked;
    }
    return (
      currentOffer.locations.find((l) => l.isDefault) ??
      currentOffer.locations[0] ??
      null
    );
  })();
  const triggerTint = getAvatarTint(currentOffer.vendorName);
  const triggerHoverVendor: PartnerHoverCardVendor = {
    name: currentOffer.vendorName,
    abbr: currentOffer.abbr,
    priorityLabel: getPriorityBadge(currentOffer.priority).label,
    location: triggerDefaultLoc
      ? { name: triggerDefaultLoc.name, address: triggerDefaultLoc.address }
      : undefined,
    contact: {
      name: currentOffer.contact.name,
      role: currentOffer.contact.role,
      email: currentOffer.contact.email,
      phone: currentOffer.contact.phone,
      initials: currentOffer.contact.initials,
    },
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-start gap-3 w-full p-3 rounded-[var(--radius-md)] border transition-all cursor-pointer text-left ${
            hasMultipleVendors
              ? "border-border hover:border-primary/30 hover:shadow-[var(--elevation-sm)]"
              : "border-border"
          }`}
          style={{ backgroundColor: "hsl(var(--card))" }}
          onClick={(e) => {
            if (!hasMultipleVendors) { e.preventDefault(); return; }
            e.stopPropagation();
          }}
          disabled={!hasMultipleVendors}
        >
          <PartnerHoverCard vendor={triggerHoverVendor} side="bottom" align="start">
            <div
              className="flex items-center justify-center size-9 rounded-lg shrink-0 border border-[#E8ECF1] overflow-hidden cursor-pointer"
              style={{ backgroundColor: triggerTint.bg }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: triggerTint.fg,
                  fontFamily: FONT,
                }}
              >
                {currentOffer.abbr}
              </span>
            </div>
          </PartnerHoverCard>
          <div className="flex-1 min-w-0">
            {/* Identity row */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-foreground truncate"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: "1.35",
                  fontFamily: FONT,
                }}
              >
                {currentOffer.vendorName}
              </span>
              {currentOffer.isDefault && (
                <Badge
                  variant="outline"
                  className="rounded-[var(--radius-sm)] px-1.5 py-0 border-primary/30 text-primary bg-primary/5 shrink-0"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    lineHeight: "14px",
                    fontFamily: FONT,
                  }}
                >
                  Default
                </Badge>
              )}
            </div>
            {/* Price row */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-primary"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: "1.35",
                  fontFamily: FONT,
                }}
              >
                ${currentOffer.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {currentOffer.defaultUOM}
              </span>
              {hasMultipleVendors && (
                <span
                  className="text-foreground/40"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: "1.35",
                    fontFamily: FONT,
                  }}
                >
                  · {offers.length} vendors available
                </span>
              )}
            </div>
            {/* Location row — mirrors the details popover's location
                section header + primary location line. Direct-to-vendor
                picks render a dedicated line (no address). */}
            {triggerIsDirect ? (
              <div className="flex items-start gap-1.5 mt-1.5">
                <MapPin className="size-3 text-foreground/40 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span
                    className="text-foreground/80 truncate block"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      lineHeight: "1.35",
                      fontFamily: FONT,
                    }}
                  >
                    Direct to vendor
                  </span>
                  <span
                    className="text-foreground/45 block truncate"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      lineHeight: "1.35",
                      fontFamily: FONT,
                    }}
                  >
                    No specific ship-from location
                  </span>
                </div>
              </div>
            ) : triggerDefaultLoc && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <MapPin className="size-3 text-foreground/40 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="text-foreground/80 truncate"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        lineHeight: "1.35",
                        fontFamily: FONT,
                      }}
                    >
                      {triggerDefaultLoc.name}
                    </span>
                    {/* "Default" location badge removed 2026-08-03 — the
                        default is already implied by initial selection. */}
                  </div>
                  <span
                    className="text-foreground/45 block truncate"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      lineHeight: "1.35",
                      fontFamily: FONT,
                    }}
                  >
                    {triggerDefaultLoc.address}
                  </span>
                </div>
              </div>
            )}
          </div>
          {hasMultipleVendors && (
            <ChevronDown className="size-4 text-foreground/30 shrink-0 mt-1" />
          )}
        </button>
      </PopoverTrigger>

      {hasMultipleVendors && (
        <PopoverContent
          className="w-auto max-w-[calc(100vw-16px)] p-0 border-border overflow-hidden"
          style={{
            fontFamily: FONT,
            backgroundColor: "hsl(var(--card))",
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
          }}
          align="start"
          sideOffset={8}
          onInteractOutside={guardVendorPopoverDismiss}
          onPointerDownOutside={guardVendorPopoverDismiss}
          onFocusOutside={guardVendorPopoverDismiss}
        >
          <VendorSelectorContent
            offers={offers}
            selectedVendor={selectedVendor}
            onSelect={handleSelect}
            onAddNewVendor={handleAddNewVendor}
            selectedLocationByVendor={selectedLocByVendor}
            onLocationChange={handleLocationChange}
            isLocationQualified={isLocationQualified}
            onLocationNeedsQualification={handleLocationNeedsQualification}
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
  selectedLocationByVendor,
  onLocationChange,
  isLocationQualified,
  onLocationNeedsQualification,
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
  /** Controlled map of vendor → selected location name. If omitted the
   *  component manages its own internal state. Lifted here so the top-
   *  level trigger card can display the buyer's live pick. */
  selectedLocationByVendor?: Record<string, string>;
  /** Fires when the buyer picks a location inside the details popover.
   *  Parent components can use it to propagate the choice onto the PO
   *  (delivery address, ship-to, etc.). */
  onLocationChange?: (vendorName: string, locationName: string) => void;
  /** Returns true if the (vendor, location) pair is qualified for the
   *  current item. Non-qualified locations render a warning icon and
   *  route click through `onLocationNeedsQualification`. */
  isLocationQualified?: (vendorName: string, locationName: string) => boolean;
  onLocationNeedsQualification?: (vendorName: string, locationName: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  /* Legacy `detailVendor` inline-expansion state — retired in favor of
     the portaled companion details popover (`openDetailFor` below). */

  /* ── Location picker state ─────────────────────────────────────
     Controlled from the parent when `selectedLocationByVendor` is
     provided; otherwise falls back to internal state. Default seed
     for a vendor with no explicit pick: its `isDefault` location. */
  const [internalLocByVendor, setInternalLocByVendor] = useState<
    Record<string, string>
  >({});
  const selectedLocByVendor = selectedLocationByVendor ?? internalLocByVendor;
  const commitLocationChange = (vendorName: string, locationName: string) => {
    if (onLocationChange) onLocationChange(vendorName, locationName);
    if (!selectedLocationByVendor) {
      /* Uncontrolled: keep internal state in sync. */
      setInternalLocByVendor((prev) => ({ ...prev, [vendorName]: locationName }));
    }
  };
  const [openDetailFor, setOpenDetailFor] = useState<string | null>(null);
  const vendorRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const [locSearch, setLocSearch] = useState("");

  /* Resolve the location currently selected for a given vendor. Returns
   * null when the buyer has explicitly picked "direct to vendor" (the
   * synthetic first row in the location list); the caller handles that
   * as "no ship-from location on this PO". */
  const resolveSelectedLoc = (offer: ItemVendorOffer) => {
    const stored = selectedLocByVendor[offer.vendorName];
    if (stored === "__direct__") return null;
    if (stored) {
      const match = offer.locations.find((l) => l.name === stored);
      if (match) return match;
    }
    return offer.locations.find((l) => l.isDefault) ?? offer.locations[0];
  };

  /* The detail column is now an inline sibling of the vendor list —
     no separate portal to position. Clicks inside are inside the
     parent PopoverContent's dismissable layer, so Radix already
     handles outside-close. */

  /* ── Radix Dialog outside-click guard ─────────────────────────
     Our details popover mounts via `createPortal(document.body)`
     so it lives OUTSIDE the parent Dialog's DOM subtree. Radix
     Dialog listens for `pointerdown` on `document` and closes when
     the target isn't inside its Content ref — that was silently
     closing the whole Items Detail modal whenever a location button
     was clicked (the "still unable to select" bug).

     A NATIVE stopPropagation at the portal broke button clicks —
     it also blocked React's root listener at document from seeing
     the event, so no synthetic `click` was dispatched to the
     buttons inside.

     Correct fix: `event.stopImmediatePropagation()` on the NATIVE
     event during React's synthetic capture. React's root listener
     dispatches synthetic events synchronously, so calling
     `stopImmediatePropagation` INSIDE the dispatch stops other
     document-level listeners (Radix's) from firing AFTER React
     returns — while React's own dispatch continues normally and
     the button's `onClick` still fires. */
  const suppressOutsideClose = React.useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.nativeEvent.stopImmediatePropagation();
    },
    [],
  );

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

  /* Currently-open picker's parent offer — used inside the portal to
     render its locations. Resolved once per render for readability. */
  const openOffer = openDetailFor
    ? offers.find((o) => o.vendorName === openDetailFor) ?? null
    : null;
  const openSelectedLoc = openOffer ? resolveSelectedLoc(openOffer) : null;
  const openFilteredLocs = useMemo(() => {
    if (!openOffer) return [];
    const q = locSearch.trim().toLowerCase();
    if (!q) return openOffer.locations;
    return openOffer.locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q),
    );
  }, [openOffer, locSearch]);

  return (
    /* Single two-column layout — vendor list on the left, vendor
       detail inline on the right (buyer 2026-07-30, matches the
       ShippingCarrierPicker pattern). Rendered inside the parent's
       PopoverContent so both panels share one border, one shadow,
       and one dismissable layer. */
    <div className="flex" style={{ fontFamily: FONT }}>
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 400,
        fontFamily: FONT,
        maxHeight: "min(560px, 80vh)",
        borderRight: openOffer ? "1px solid hsl(var(--border))" : undefined,
      }}
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
                backgroundColor: "hsl(var(--input-background))",
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
        /* stopPropagation on wheel so a Popover-inside-Dialog stack doesn't
           swallow the scroll (Radix Dialog scroll-lock can propagate up and
           block wheel-scroll on nested scrollable areas otherwise). */
        onWheel={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: "thin", overscrollBehavior: "contain" }}
      >
        <div className="flex flex-col py-1">
          {filteredOffers.map((offer) => {
            const isSelected = offer.vendorName === selectedVendor;
            const badge = getPriorityBadge(offer.priority);

            return (
              <div
                key={offer.vendorName}
                ref={(el) => {
                  /* Attach the row ref so the companion details popover
                     can measure from this element's bounding box and
                     anchor beside it. */
                  vendorRowRefs.current[offer.vendorName] = el as unknown as HTMLButtonElement | null;
                }}
              >
                {/* ── Compact row ── */}
                <div
                  className={`group flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-[var(--radius-md)] cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/5 ring-1 ring-inset ring-primary/15"
                      : openDetailFor === offer.vendorName
                        ? "bg-primary/[0.03] ring-1 ring-inset ring-primary/10"
                        : "hover:bg-secondary/70"
                  }`}
                  onClick={() => onSelect(offer)}
                >
                  {/* Avatar — Partners-style squircle (`rounded-lg`) with
                      a hash-derived tint from the vendor name so every
                      vendor gets its own colour (blue/green/violet/
                      orange/rose/…). Matches the Contacts Directory
                      `PersonAvatar` recipe (`ContactsDirectoryPage.tsx:298`). */}
                  {(() => {
                    const tint = getAvatarTint(offer.vendorName);
                    const rowDefaultLoc =
                      offer.locations.find((l) => l.isDefault) ??
                      offer.locations[0] ??
                      null;
                    const hoverVendor: PartnerHoverCardVendor = {
                      name: offer.vendorName,
                      abbr: offer.abbr,
                      priorityLabel: badge.label,
                      location: rowDefaultLoc
                        ? { name: rowDefaultLoc.name, address: rowDefaultLoc.address }
                        : undefined,
                      contact: {
                        name: offer.contact.name,
                        role: offer.contact.role,
                        email: offer.contact.email,
                        phone: offer.contact.phone,
                        initials: offer.contact.initials,
                      },
                    };
                    return (
                      <PartnerHoverCard vendor={hoverVendor} side="right" align="start">
                        <div
                          className="flex items-center justify-center size-8 rounded-lg shrink-0 border border-[#E8ECF1] overflow-hidden cursor-pointer"
                          style={{ backgroundColor: tint.bg }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              fontFamily: FONT,
                              color: tint.fg,
                            }}
                          >
                            {offer.abbr}
                          </span>
                        </div>
                      </PartnerHoverCard>
                    );
                  })()}

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
                          className="text-primary block"
                          style={{
                            fontSize: "11px",
                            fontWeight: "var(--font-weight-semibold)",
                            lineHeight: "1.35",
                            fontFamily: FONT,
                          }}
                        >
                          ${offer.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {offer.defaultUOM}
                          {/* Multi-unit indicator: shown when the vendor has more
                              than one configured unit-price tier on this item. */}
                          {(() => {
                            const extra = (offer.unitPrices?.length ?? 0) - 1;
                            return extra > 0 ? (
                              <span
                                className="text-muted-foreground ml-1"
                                style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
                                title={`Also available: ${(offer.unitPrices ?? [])
                                  .filter((t) => !t.isDefault)
                                  .map((t) => `$${t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${t.unit}`)
                                  .join(", ")}`}
                              >
                                (+{extra} unit{extra > 1 ? "s" : ""})
                              </span>
                            ) : null;
                          })()}
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
                        /* Open the companion details popover for this
                           vendor (portaled to body — see the block at
                           the bottom of this component). Toggling the
                           chevron on the already-open vendor closes it. */
                        setOpenDetailFor(
                          openDetailFor === offer.vendorName ? null : offer.vendorName,
                        );
                      }}
                      title={openDetailFor === offer.vendorName ? "Hide details" : "View details"}
                      aria-expanded={openDetailFor === offer.vendorName}
                      aria-haspopup="dialog"
                    >
                      {openDetailFor === offer.vendorName ? (
                        <ChevronUp className="size-3.5 text-primary" />
                      ) : (
                        <ChevronDown className="size-3.5 text-foreground/30" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Details are rendered in a COMPANION POPOVER portaled
                    to <body> (see the block at the bottom of this
                    component). The compact vendor row above is all that
                    renders inline; clicking the chevron opens the
                    detail panel beside the vendor list. */}
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

    {/* ── Vendor DETAIL COLUMN ──────────────────────────────
        Inline sibling column. Renders only when a vendor is
        expanded (openOffer). No independent portal / shadow —
        shares chrome with the vendor list on the left, matching
        the ShippingCarrierPicker two-column recipe. */}
    {openOffer && (
      <div
        ref={detailPanelRef}
        data-vendor-detail-popover
        className="flex flex-col overflow-hidden bg-popover shrink-0"
        style={{
          width: 320,
          maxHeight: "min(560px, 80vh)",
          fontFamily: FONT,
        }}
        aria-label={`${openOffer.vendorName} details`}
      >
        {/* ── Identity header ── Partners-style squircle avatar so
            the details popover visually connects to the vendor list
            (same colour + shape). A leading radio button lets the
            buyer explicitly pick THIS vendor as the ordering vendor
            without dismissing the details panel — mirrors the
            location radios below so "select vendor OR location"
            reads consistently (buyer 2026-07-30). */}
        {(() => {
          const tint = getAvatarTint(openOffer.vendorName);
          return (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <div
            className="flex items-center justify-center size-8 rounded-lg shrink-0 border border-[#E8ECF1] overflow-hidden"
            style={{ backgroundColor: tint.bg }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: FONT,
                color: tint.fg,
              }}
            >
              {openOffer.abbr}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="text-foreground truncate block"
              style={{
                fontSize: 13,
                fontWeight: "var(--font-weight-semibold)",
                lineHeight: "1.35",
                fontFamily: FONT,
              }}
            >
              {shortVendorName(openOffer.vendorName)}
            </span>
            {!hidePrice && openOffer.unitPrice > 0 && (
              <span
                className="text-primary block truncate"
                style={{
                  fontSize: 11,
                  fontWeight: "var(--font-weight-semibold)",
                  lineHeight: "1.35",
                  fontFamily: FONT,
                }}
              >
                ${openOffer.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {openOffer.defaultUOM}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDetailFor(null);
              setLocSearch("");
            }}
            className="grid place-items-center size-5 rounded text-foreground/40 hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
            aria-label="Close details"
          >
            <X className="size-3" />
          </button>
        </div>
          );
        })()}

        {/* ── Scrollable body — location list + contact ── */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {/* Price row (only when a price exists and hidePrice is off) */}
          {!hidePrice && openOffer.unitPrice > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-2">
                <span
                  className="text-primary"
                  style={{
                    fontSize: 12,
                    fontWeight: "var(--font-weight-semibold)",
                    fontFamily: FONT,
                    lineHeight: "1.4",
                  }}
                >
                  Price per unit : ${openOffer.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {openOffer.defaultUOM} ({openOffer.defaultUOM})
                </span>
              </div>
              <div className="h-px mx-3" style={{ backgroundColor: "hsl(var(--border))" }} />
            </>
          )}

          {/* Location section */}
          <div className="px-3 pt-2 pb-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="size-3 text-primary/60" />
              <span
                className="text-foreground/50"
                style={{
                  fontSize: 10,
                  fontWeight: "var(--font-weight-semibold)",
                  fontFamily: FONT,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                }}
              >
                Location ({openOffer.locations.length + 1})
              </span>
            </div>

            {/* Search — auto-shows for vendors with > 4 locations. */}
            {openOffer.locations.length > 4 && (
              <div className="relative mb-1.5">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-foreground/30" />
                <input
                  type="text"
                  value={locSearch}
                  onChange={(e) => setLocSearch(e.target.value)}
                  placeholder="Search locations..."
                  className="h-7 w-full rounded-[var(--radius-sm)] border border-border pl-7 pr-7 text-foreground placeholder:text-foreground/30 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    fontFamily: FONT,
                    backgroundColor: "hsl(var(--input-background))",
                  }}
                />
                {locSearch && (
                  <button
                    type="button"
                    onClick={() => setLocSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground cursor-pointer transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}

            {/* Radio-style single-select list. The first row is always
                the vendor itself — represents "direct to vendor, no
                specific ship-from location". Real locations follow. */}
            <div className="flex flex-col gap-0.5">
              {(() => {
                const directSelected = selectedLocByVendor[openOffer.vendorName] === "__direct__";
                const q = locSearch.trim().toLowerCase();
                const directVisible = !q || openOffer.vendorName.toLowerCase().includes(q);
                if (!directVisible) return null;
                return (
                  <button
                    key="__direct__"
                    type="button"
                    role="radio"
                    aria-checked={directSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      /* Close the picker before committing so the parent's
                         "Create new PO?" swap warning (edit-po state) isn't
                         visually stacked under this popover. */
                      setOpenDetailFor(null);
                      setLocSearch("");
                      commitLocationChange(openOffer.vendorName, "__direct__");
                    }}
                    onPointerDownCapture={suppressOutsideClose}
                    className={`w-full flex items-start gap-2.5 py-2 px-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer text-left border ${
                      directSelected
                        ? "border-primary/40 bg-primary/[0.06]"
                        : "border-transparent hover:bg-secondary/70"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex items-center justify-center size-3.5 rounded-full border-2 shrink-0 transition-colors ${
                        directSelected ? "border-primary" : "border-foreground/25"
                      }`}
                    >
                      {directSelected && <span className="block size-1.5 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-foreground truncate block"
                        style={{
                          fontSize: 12,
                          fontWeight: directSelected ? 600 : 500,
                          lineHeight: "1.35",
                          fontFamily: FONT,
                        }}
                      >
                        {shortVendorName(openOffer.vendorName)}
                      </span>
                      <span
                        className="text-foreground/45 block truncate"
                        style={{ fontSize: 10, fontFamily: FONT, lineHeight: "1.35" }}
                      >
                        Direct to vendor — no specific location
                      </span>
                    </div>
                  </button>
                );
              })()}
              {openFilteredLocs.length === 0 ? (
                <div
                  className="py-3 text-center text-foreground/35"
                  style={{ fontSize: 12, fontFamily: FONT }}
                >
                  No matching locations.
                </div>
              ) : (
                openFilteredLocs.map((loc) => {
                  const isSelected = openSelectedLoc?.name === loc.name;
                  const qualified = isLocationQualified
                    ? isLocationQualified(openOffer.vendorName, loc.name)
                    : true;
                  return (
                    <button
                      key={loc.name}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        /* Always close the detail popover on a location pick.
                           - Non-qualified case: routes to the scope-prompt
                             owner (parent OrderFlow) — popover must dismiss
                             so the prompt isn't stacked underneath
                             (buyer 2026-07-30).
                           - Qualified case: the parent may still defer with
                             the "Create new PO?" swap warning (edit-po
                             state); dismissing here keeps the swap modal
                             the only thing on screen (buyer 2026-08-10). */
                        setOpenDetailFor(null);
                        setLocSearch("");
                        if (!qualified && onLocationNeedsQualification) {
                          onLocationNeedsQualification(openOffer.vendorName, loc.name);
                          return;
                        }
                        commitLocationChange(openOffer.vendorName, loc.name);
                      }}
                      onPointerDownCapture={suppressOutsideClose}
                      className={`w-full flex items-start gap-2.5 py-2 px-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer text-left border ${
                        isSelected
                          ? "border-primary/40 bg-primary/[0.06]"
                          : !qualified
                            ? "border-transparent hover:bg-amber-50/60"
                            : "border-transparent hover:bg-secondary/70"
                      }`}
                    >
                      {/* Radio indicator — matches shadcn/Partners
                          radio recipe. Outer ring + inner dot when
                          checked. Clear signal that this is a
                          single-select control. */}
                      <span
                        className={`mt-0.5 flex items-center justify-center size-3.5 rounded-full border-2 shrink-0 transition-colors ${
                          isSelected ? "border-primary" : "border-foreground/25"
                        }`}
                      >
                        {isSelected && (
                          <span className="block size-1.5 rounded-full bg-primary" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="text-foreground truncate"
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected ? 600 : 500,
                              lineHeight: "1.35",
                              fontFamily: FONT,
                            }}
                          >
                            {loc.name}
                          </span>
                          {/* Buyer 2026-08-03: drop the "Default" badge on
                              location rows — the default location is already
                              conveyed by ordering + the row-radio state. */}
                          {!qualified && (
                            <span
                              className="inline-flex items-center gap-0.5 shrink-0 rounded-[var(--radius-sm)]"
                              title="This location isn't qualified for this item yet"
                              style={{
                                fontSize: 9,
                                fontWeight: "var(--font-weight-medium)",
                                fontFamily: FONT,
                                lineHeight: "1.3",
                                padding: "1px 5px 1px 4px",
                                color: "#B45309",
                                backgroundColor: "#FEF3C7",
                                border: "1px solid #FDE68A",
                              }}
                            >
                              <AlertTriangle
                                className="size-2.5"
                                style={{ color: "#B45309" }}
                              />
                              Not qualified
                            </span>
                          )}
                        </div>
                        <span
                          className="text-foreground/45 block truncate"
                          style={{
                            fontSize: 10,
                            fontWeight: "var(--font-weight-normal)",
                            fontFamily: FONT,
                            lineHeight: "1.35",
                          }}
                        >
                          {loc.address}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="h-px mx-3" style={{ backgroundColor: "hsl(var(--border))" }} />

          {/* Point-of-Contact card — Partners recipe
              (`ContactsDirectoryPage.tsx:1330-1348`): tinted circular
              avatar, name (13/600), role (11/muted), then stacked
              icon-prefixed contact rows at 12/slate-700. Rendered
              inline in the popover (not as a hover) since the popover
              itself is the detail surface. */}
          <div className="px-3 pt-2 pb-3">
            {/* Section label */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="text-foreground/50"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: FONT,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                }}
              >
                Point of contact
              </span>
            </div>
            {(() => {
              const contactTint = getAvatarTint(openOffer.contact.name);
              return (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-[#E8ECF1]"
                      style={{ backgroundColor: contactTint.bg }}
                    >
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          fontFamily: FONT,
                          color: contactTint.fg,
                        }}
                      >
                        {openOffer.contact.initials}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-slate-800 truncate"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: "1.35",
                          fontFamily: FONT,
                        }}
                      >
                        {openOffer.contact.name}
                      </p>
                      <p
                        className="text-slate-500 truncate"
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          lineHeight: "1.35",
                          fontFamily: FONT,
                        }}
                      >
                        {openOffer.contact.role}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="px-3 py-2 space-y-1.5">
                    {openOffer.contact.phone && (
                      <div className="flex items-center gap-2.5 text-slate-700" style={{ fontSize: 12, fontFamily: FONT }}>
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${openOffer.contact.phone.replace(/[^\d+]/g, "")}`}
                          className="truncate hover:text-primary hover:underline transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {openOffer.contact.phone}
                        </a>
                      </div>
                    )}
                    {openOffer.contact.email && (
                      <div className="flex items-center gap-2.5 text-slate-700" style={{ fontSize: 12, fontFamily: FONT }}>
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`mailto:${openOffer.contact.email}`}
                          className="truncate hover:text-primary hover:underline transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {openOffer.contact.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
