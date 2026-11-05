import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Search, X, ChevronDown, ChevronRight, MapPin, Check, Truck } from "lucide-react";
import { PrimaryPill } from "./PrimaryPill";
import {
  PARTNER_LOCATION_ITEMS,
  type PartnerLocationItem,
} from "./partnerLocationData";

/**
 * ── SelectPartnerLocationDialog ───────────────────────────────────
 * Searchable accordion partner-selection dialog ported from the
 * Partners application's `renderPartnerSelectionDialog` so PO Detail
 * page pickers (Ship To / Pay To / Funded By) feel identical to the
 * configure-vendor flow users already know.
 *
 * Behavior:
 *   - Header: configurable icon + title + description + close X.
 *   - Search input (autoFocus). Typing narrows to matching partners
 *     and locations and auto-expands every partner that matches so
 *     the user can see hits without manual expansion.
 *   - Body: partners with nested locations rendered as an accordion.
 *     Orphan locations (locations not under any partner in the list)
 *     render below as flat rows.
 *   - Footer (only when something is selected): tiny green status
 *     dot + "Selected: <name>" + Done button.
 *   - Selecting a row closes the dialog. The Done button is a
 *     visual confirmation; it just closes too.
 *   - Closing clears search + expanded state.
 */
export interface SelectPartnerLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (item: PartnerLocationItem) => void;
  /** Optional subset; defaults to the full PARTNER_LOCATION_ITEMS. */
  items?: PartnerLocationItem[];
  /** Header configuration. Defaults to the Ship To preset. */
  config?: {
    icon?: React.ReactNode;
    iconBg?: string;
    iconColor?: string;
    title?: string;
    description?: string;
  };
  /** Search input placeholder. Defaults to "Search partners & locations...". */
  searchPlaceholder?: string;
  /** Partner-level only: no nested locations, no "N locs" count, no
   *  expand chevron. Pay To and Funded By never pick a location
   *  (ERP-4790, ERP-6264). */
  partnersOnly?: boolean;
}

// ── highlight helper ────────────────────────────────────────────────
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <span>
      {text.slice(0, idx)}
      <span
        className="bg-[#FEF08A] text-foreground rounded-sm px-0.5"
        style={{ fontWeight: 600 }}
      >
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ── partner logo with image fallback ───────────────────────────────
function PartnerLogo({
  item,
  size = 36,
  className: cls = "",
}: {
  item: PartnerLocationItem;
  size?: number;
  className?: string;
}) {
  const [imgErr, setImgErr] = useState(false);
  if (item.logoUrl && !imgErr) {
    return (
      <div
        className={`rounded-lg border border-[#E8ECF1] bg-white flex items-center justify-center shrink-0 overflow-hidden ${cls}`}
        style={{ width: size, height: size }}
      >
        <img
          src={item.logoUrl}
          alt={item.name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg flex items-center justify-center text-white shrink-0 ${cls}`}
      style={{
        width: size,
        height: size,
        backgroundColor: item.logoColor,
        fontWeight: 700,
        fontSize: size * 0.3,
      }}
    >
      {item.logoText}
    </div>
  );
}

// ── grouping helper ─────────────────────────────────────────────────
function buildGroupedItems(items: PartnerLocationItem[], searchQuery: string, partnersOnly = false) {
  const partners = items.filter((i) => i.type === "partner");
  const locations = partnersOnly ? [] : items.filter((i) => i.type === "location");
  const q = searchQuery.toLowerCase().trim();
  const grouped = partners.map((p) => {
    const pLocations = locations.filter(
      (l) => l.logoText === p.logoText && l.logoColor === p.logoColor,
    );
    const partnerMatches =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.displayName && p.displayName.toLowerCase().includes(q)) ||
      (!partnersOnly && p.location && p.location.toLowerCase().includes(q));
    const matchingLocations = !q
      ? pLocations
      : pLocations.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.location && l.location.toLowerCase().includes(q)),
        );
    const hasMatch = partnerMatches || matchingLocations.length > 0;
    return {
      partner: p,
      locations: pLocations,
      matchingLocations,
      partnerMatches: partnerMatches as boolean,
      hasMatch,
      expanded: !!q && hasMatch,
    };
  });
  const groupedLocationIds = new Set(
    grouped.flatMap((g) => g.locations.map((l) => l.id)),
  );
  const orphanLocations = locations.filter(
    (l) => !groupedLocationIds.has(l.id),
  );
  const matchingOrphans = !q
    ? orphanLocations
    : orphanLocations.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.location && l.location.toLowerCase().includes(q)),
      );
  return {
    grouped: grouped.filter((g) => !q || g.hasMatch),
    orphanLocations: !q ? orphanLocations : matchingOrphans,
  };
}

// ── main dialog component ──────────────────────────────────────────
export function SelectPartnerLocationDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
  items = PARTNER_LOCATION_ITEMS,
  config,
  searchPlaceholder = "Search partners & locations...",
  partnersOnly = false,
}: SelectPartnerLocationDialogProps) {
  const [search, setSearch] = useState("");
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(
    new Set(),
  );

  const { grouped, orphanLocations } = buildGroupedItems(items, search, partnersOnly);
  const hasSearch = search.trim().length > 0;

  const headerIcon = config?.icon ?? (
    <Truck className="w-4 h-4 text-[#22C55E]" />
  );
  const headerIconBg = config?.iconBg ?? "#ECFDF5";
  const headerTitle = config?.title ?? "Select Ship To";
  const headerDescription = config?.description ?? "Choose delivery destination";

  const togglePartnerExpand = (partnerId: string) => {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  };

  const closeAndReset = () => {
    onOpenChange(false);
    setSearch("");
    setExpandedPartners(new Set());
  };

  const handleSelect = (item: PartnerLocationItem) => {
    onSelect(item);
    closeAndReset();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setSearch("");
          setExpandedPartners(new Set());
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className="bg-background fixed top-[50%] left-[50%] z-50 w-[calc(100%-2rem)] !max-w-[520px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border-0 overflow-hidden p-0 gap-0 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit [transform-origin:center_center]"
          style={{
            boxShadow:
              "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
          <DialogTitle className="sr-only">{headerTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {headerDescription}
          </DialogDescription>

          {/* ── Header ── */}
          <div className="px-5 pt-4 pb-3 border-b border-muted">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: headerIconBg }}
                >
                  {headerIcon}
                </div>
                <div>
                  <h3
                    className="text-sm text-foreground"
                    style={{ fontWeight: 600 }}
                  >
                    {headerTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {headerDescription}
                  </p>
                </div>
              </div>
              <button
                onClick={closeAndReset}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                autoFocus
              />
            </div>
          </div>

          {/* ── Body ── */}
          <div className="max-h-[420px] overflow-y-auto">
            {grouped.length === 0 && orphanLocations.length === 0 ? (
              <div className="py-10 text-center">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p
                  className="text-sm text-slate-500"
                  style={{ fontWeight: 500 }}
                >
                  No results found
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Try a different search term
                </p>
              </div>
            ) : (
              <div className="py-1">
                {grouped.map(({ partner, locations: allLocs, matchingLocations }) => {
                  const locsToShow = hasSearch ? matchingLocations : allLocs;
                  const isPartnerSelected = selectedId === partner.id;
                  const isExpanded = hasSearch
                    ? true
                    : expandedPartners.has(partner.id);
                  const hasLocs = locsToShow.length > 0;
                  return (
                    <div
                      key={partner.id}
                      className="border-b border-slate-50 last:border-b-0"
                    >
                      <div
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 ${
                          isPartnerSelected ? "bg-accent/60" : ""
                        }`}
                      >
                        {hasLocs ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePartnerExpand(partner.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : partnersOnly ? null : (
                          <div className="w-5 h-5 shrink-0" />
                        )}
                        <PartnerLogo item={partner} size={32} />
                        <button
                          onClick={() => handleSelect(partner)}
                          className="flex flex-col min-w-0 flex-1 text-left"
                        >
                          <span
                            className="text-[13px] text-foreground truncate"
                            style={{ fontWeight: 600 }}
                          >
                            {highlightMatch(partner.displayName ?? partner.name, search)}
                          </span>
                          {partner.displayName && (
                            <span className="text-[11px] text-slate-500 truncate">
                              {highlightMatch(partner.name, search)}
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {partner.isDefault && <PrimaryPill size="xs" />}
                          {hasLocs && (
                            <span
                              className="text-[10px] text-slate-400 bg-slate-50 border border-[#E8ECF1] px-1.5 py-0.5 rounded"
                              style={{ fontWeight: 500 }}
                            >
                              {locsToShow.length} loc
                              {locsToShow.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {isPartnerSelected && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                      {isExpanded && hasLocs && (
                        <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                          {locsToShow.map((loc) => {
                            const isLocSelected = selectedId === loc.id;
                            return (
                              <button
                                key={loc.id}
                                onClick={() => handleSelect(loc)}
                                className={`w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left transition-colors hover:bg-muted ${
                                  isLocSelected ? "bg-accent/60" : ""
                                }`}
                              >
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span
                                    className="text-[12px] text-slate-700 truncate"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {highlightMatch(loc.name, search)}
                                  </span>
                                  {loc.location && (
                                    <span
                                      className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(
                                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            loc.location!,
                                          )}`,
                                          "_blank",
                                        );
                                      }}
                                    >
                                      {highlightMatch(loc.location, search)}
                                    </span>
                                  )}
                                </div>
                                {isLocSelected && (
                                  <Check className="w-4 h-4 text-primary shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {orphanLocations.length > 0 && (
                  <>
                    {grouped.length > 0 && (
                      <div className="border-t border-muted my-1" />
                    )}
                    {orphanLocations.map((loc) => {
                      const isLocSelected = selectedId === loc.id;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => handleSelect(loc)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                            isLocSelected ? "bg-accent/60" : ""
                          }`}
                        >
                          <div className="w-5 h-5 shrink-0" />
                          <PartnerLogo item={loc} size={32} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className="text-[13px] text-foreground truncate"
                              style={{ fontWeight: 500 }}
                            >
                              {highlightMatch(loc.name, search)}
                            </span>
                            {loc.location && (
                              <span
                                className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      loc.location!,
                                    )}`,
                                    "_blank",
                                  );
                                }}
                              >
                                {highlightMatch(loc.location, search)}
                              </span>
                            )}
                          </div>
                          {isLocSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Footer (only when something is selected) ── */}
          {selectedId && (
            <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                <span
                  className="text-xs text-slate-700 truncate"
                  style={{ fontWeight: 500 }}
                >
                  Selected:{" "}
                  <span style={{ fontWeight: 600 }}>
                    {(() => {
                      const sel = items.find((i) => i.id === selectedId);
                      return sel?.displayName ?? sel?.name ?? "";
                    })()}
                  </span>
                </span>
              </div>
              <button
                onClick={closeAndReset}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors"
                style={{ fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
