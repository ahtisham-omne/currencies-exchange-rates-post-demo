import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Package,
  Building2,
  ArrowRight,
  ChevronDown,
  Tag,
  Clock,
  Keyboard,
  CornerDownLeft,
  ArrowUpDown,
  Sparkles,
  TrendingUp,
  Box,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  CATALOG,
  getVendorOffersForItem,
  getVendorSuggestions,
} from "./catalogData";
import type { CatalogItem, ItemVendorOffer } from "./catalogData";
import { FONT, typography as s } from "./designTokens";
import TruncatedItemName from "./TruncatedItemName";
import VendorSelector from "./VendorSelector";
import { POPriceDisplay } from "./currency/POPriceDisplay";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const t = {
  searchInput: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "24px",
    fontFamily: FONT,
  } as React.CSSProperties,

  partNumber: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  itemDesc: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  badge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,

  vendorName: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  vendorMeta: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  vendorPrice: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  footerText: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  footerBtn: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  matchHint: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,

  kbdKey: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,

  emptyTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,

  emptyDesc: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  tipLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  tipDesc: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  resultCount: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  categoryLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  abbr: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
    letterSpacing: "0.03em",
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   VENDOR AVATAR COLORS
   ═══════════════════════════════════════════════════════════════ */

const VENDOR_PALETTES = [
  { bg: "var(--avatar-1-bg)", text: "var(--avatar-1-text)" },
  { bg: "var(--avatar-2-bg)", text: "var(--avatar-2-text)" },
  { bg: "var(--avatar-3-bg)", text: "var(--avatar-3-text)" },
  { bg: "var(--avatar-4-bg)", text: "var(--avatar-4-text)" },
  { bg: "var(--avatar-5-bg)", text: "var(--avatar-5-text)" },
  { bg: "var(--avatar-6-bg)", text: "var(--avatar-6-text)" },
  { bg: "var(--avatar-7-bg)", text: "var(--avatar-7-text)" },
];

function vendorColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return VENDOR_PALETTES[Math.abs(h) % VENDOR_PALETTES.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ═══════════════════════════════════════════════════════════════
   UOM FORMATTING
   ═══════════════════════════════════════════════════════════════ */

/** Map full UOM name → short code + full label */
const UOM_MAP: Record<string, string> = {
  Each: "EA (Each)", Kit: "KIT (Kit)", Unit: "UN (Unit)", Module: "MOD (Module)",
  Assembly: "ASM (Assembly)", Element: "EL (Element)", Valve: "VLV (Valve)",
  Box: "BX (Box)", Pack: "PK (Pack)", Case: "CS (Case)", Pair: "PR (Pair)",
  Set: "SET (Set)", Piece: "PC (Piece)", Roll: "RL (Roll)", Meter: "M (Meter)",
  Spool: "SPL (Spool)", Sheet: "SH (Sheet)",
  "Sub-Assembly": "SA (Sub-Assembly)",
};
function formatUOM(uom: string) { return UOM_MAP[uom] ?? uom; }

/* ══════════════════════════════════════════════════════════════
   SEARCH HELPERS — fuzzy scoring
   ═══════════════════════════════════════════════════════════════ */

type SearchMode = "items" | "vendors";

const VENDOR_SUGGESTIONS = getVendorSuggestions();

/** Score an item against the query — higher = better match */
function scoreItem(item: CatalogItem, query: string): number {
  const q = query.toLowerCase();
  const partLower = item.itemNumber.toLowerCase();
  const nameLower = item.descriptiveName.toLowerCase();
  const catLower = item.category.toLowerCase();

  // Exact start match on part number is best
  if (partLower.startsWith(q)) return 100;
  // Part number contains query
  if (partLower.includes(q)) return 80;
  // Name starts with query
  if (nameLower.startsWith(q)) return 70;
  // Individual words in name start with query
  const words = nameLower.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 60;
  // Name contains query
  if (nameLower.includes(q)) return 50;
  // Category match
  if (catLower.includes(q)) return 30;
  // Token-level partial match (each query token matches somewhere)
  const qTokens = q.split(/\s+/).filter(Boolean);
  if (qTokens.length > 1) {
    const allMatch = qTokens.every(
      (tk) => partLower.includes(tk) || nameLower.includes(tk) || catLower.includes(tk)
    );
    if (allMatch) return 40;
  }
  return 0;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const q = query.toLowerCase();
  // Try to match any query token
  const tokens = q.split(/\s+/).filter(Boolean);
  let best = { idx: -1, len: 0 };
  for (const tk of tokens) {
    const idx = text.toLowerCase().indexOf(tk);
    if (idx !== -1 && tk.length > best.len) best = { idx, len: tk.length };
  }
  if (best.idx === -1) return text;
  return (
    <>
      {text.slice(0, best.idx)}
      <mark
        className="rounded-sm px-0"
        style={{ backgroundColor: "var(--primary-tint)", color: "var(--foreground)" }}
      >
        {text.slice(best.idx, best.idx + best.len)}
      </mark>
      {text.slice(best.idx + best.len)}
    </>
  );
}

/** Get match context label */
function getMatchLabel(item: CatalogItem, query: string): string | null {
  const q = query.toLowerCase();
  if (item.itemNumber.toLowerCase().includes(q)) return "Part number match";
  if (item.descriptiveName.toLowerCase().includes(q)) return "Description match";
  if (item.category.toLowerCase().includes(q)) return `Category: ${item.category}`;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return "Multi-keyword match";
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   RECENT SEARCHES (session only)
   ═══════════════════════════════════════════════════════════════ */

const MAX_RECENT = 5;
let _recentSearches: string[] = [];

function addRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  _recentSearches = [trimmed, ..._recentSearches.filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
}

function getRecentSearches() {
  return _recentSearches;
}

function clearRecentSearches() {
  _recentSearches = [];
}

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface SearchResultItem {
  item: CatalogItem;
  offers: ItemVendorOffer[];
  score: number;
  matchLabel: string | null;
}

interface VendorResult {
  name: string;
  abbr: string;
  itemCount: number;
  categories: string[];
  score: number;
}

interface PurchaseSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemSelect: (item: CatalogItem) => void;
  onVendorSelect: (vendorName: string) => void;
  onBrowseCatalog: (searchTerm?: string) => void;
  /** When set, only show items from this vendor and hide vendor search */
  vendorFilter?: string;
  /** When true, don't close the modal after selecting an item */
  keepOpenOnSelect?: boolean;
  /** Item numbers already added — shows "In PO" badge instead of select button */
  existingItemNumbers?: string[];
  /** Custom label for the select button (default: "Select") */
  selectButtonLabel?: string;
}

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD HINT
   ═══════════════════════════════════════════════════════════════ */

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-[3px]"
      style={{
        backgroundColor: "var(--secondary)",
        border: "1px solid var(--border)",
        color: "var(--muted-foreground)",
        ...t.kbdKey,
      }}
    >
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEARCH CATEGORY SELECTOR (Items / Vendors dropdown)
   ═══════════════════════════════════════════════════════════════ */

function CategorySelector({
  mode,
  onModeChange,
  disabled,
}: {
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const label = mode === "items" ? "Items" : "Vendors";
  const Icon = mode === "items" ? Package : Building2;

  if (disabled) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 shrink-0"
        style={{
          borderRight: "1px solid var(--border)",
          color: "var(--muted-foreground)",
          height: "100%",
          ...t.categoryLabel,
        }}
      >
        <Package className="size-3.5" />
        Items
      </div>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0 h-full">
      <button
        className="flex items-center gap-1.5 px-3 h-full cursor-pointer transition-colors"
        style={{
          borderRight: "1px solid var(--border)",
          color: "var(--foreground)",
          backgroundColor: open ? "var(--secondary)" : "transparent",
          ...t.categoryLabel,
        }}
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <Icon className="size-3.5" style={{ color: "var(--primary)" }} />
        {label}
        <ChevronDown
          className="size-3 transition-transform"
          style={{
            color: "var(--muted-foreground)",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1 z-50 w-[180px] py-1 rounded-[var(--radius)] overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              boxShadow: "var(--elevation-sm)",
              border: "1px solid var(--border)",
            }}
          >
            {(["items", "vendors"] as SearchMode[]).map((m) => {
              const active = mode === m;
              const MIcon = m === "items" ? Package : Building2;
              return (
                <button
                  key={m}
                  className="flex items-center gap-2.5 w-full px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? "var(--primary-tint)" : "transparent",
                    color: active ? "var(--primary)" : "var(--foreground)",
                    ...t.categoryLabel,
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = active ? "var(--primary-tint)" : "transparent"; }}
                  onClick={() => { onModeChange(m); setOpen(false); }}
                >
                  <MIcon className="size-3.5" />
                  {m === "items" ? "Items / SKUs" : "Vendors / Suppliers"}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   ITEM RESULT ROW — Exact catalogue list-view card (from NewPurchaseOrderPage)
   ═══════════════════════════════════════════════════════════════ */

function ItemResultRow({
  result,
  query,
  isActive,
  onSelect,
  onMouseEnter,
  alreadyAdded,
  selectLabel,
}: {
  result: SearchResultItem;
  query: string;
  isActive: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  alreadyAdded?: boolean;
  selectLabel?: string;
}) {
  const { item, matchLabel } = result;

  /* Filter vendor offers to only those matching the search query */
  const filteredOffers = useMemo(() => {
    if (!query.trim()) return result.offers;
    const q = query.trim().toLowerCase();
    const matched = result.offers.filter((o) => o.vendorName.toLowerCase().includes(q));
    // If no vendors match the query, show all (query matched item, not vendor)
    return matched.length > 0 ? matched : result.offers;
  }, [result.offers, query]);
  const belowMin = item.currentStock < item.minQuantity;
  const stockDiff = belowMin ? item.minQuantity - item.currentStock : 0;

  /* ── Vendor chip (compact) — exact same logic as catalogue ── */
  const vendorChipCompact = filteredOffers.length > 0 ? (
    <div onClick={(e) => e.stopPropagation()}>
      <VendorSelector
        offers={filteredOffers}
        selectedVendor={item.partnerLocation}
        onSelectVendor={() => {}}
        variant="compact"
      />
    </div>
  ) : !item.partnerLocation ? (
    <button
      className="inline-flex items-center gap-1 px-2 rounded-[var(--radius-sm)] border border-chart-3/30 bg-chart-3/5 cursor-pointer hover:bg-chart-3/10 transition-colors h-[22px]"
      style={{ ...s.cardMeta, fontSize: "9px" }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <AlertTriangle className="size-2.5 text-chart-3 shrink-0" />
      <span className="text-chart-3" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>Assign Vendor</span>
    </button>
  ) : (
    <div className="inline-flex items-center gap-1 min-w-0">
      <Building2 className="size-2.5 text-muted-foreground/50 shrink-0" />
      <span className="text-muted-foreground truncate" style={{ ...s.cardMeta, fontSize: "9px" }}>{item.partnerLocation}</span>
    </div>
  );

  /* ── Stock info (exact same as catalogue) ── */
  const stockInfo = (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-muted-foreground" style={s.cardMeta}>
        Below min:{" "}
        {belowMin ? (
          <span className="text-destructive" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{stockDiff} {item.defaultUOM}</span>
        ) : (
          <span className="text-foreground/30" style={{ fontWeight: "var(--font-weight-normal)", fontFamily: FONT }}>—</span>
        )}
      </span>
      <span className="text-muted-foreground" style={s.cardMeta}>
        Shortage:{" "}
        {item.shortageDate ? (
          <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{item.shortageDate}</span>
        ) : (
          <span className="text-foreground/30" style={{ fontWeight: "var(--font-weight-normal)", fontFamily: FONT }}>—</span>
        )}
      </span>
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={-1}
      className={`flex items-stretch rounded-[var(--radius-lg)] border overflow-hidden transition-all duration-150 group mx-3 my-1.5 ${
        isActive ? "border-primary/30 ring-1 ring-primary/10" : "border-border hover:shadow-[var(--elevation-sm)]"
      }`}
      style={{ backgroundColor: "var(--card)", opacity: alreadyAdded ? 0.6 : 1 }}
      onClick={alreadyAdded ? undefined : onSelect}
      onMouseEnter={onMouseEnter}
    >
      {/* Thumbnail — 140×140 square per Figma (exact match) */}
      <div
        className="relative shrink-0 w-[140px] h-[140px] overflow-hidden cursor-pointer"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <ImageWithFallback
          src={item.image}
          alt={item.descriptiveName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Content — matches Figma layout (exact copy from catalogue) */}
      <div className="flex flex-col flex-1 min-w-0 py-2.5 pl-3 gap-0">
        {/* IN STOCK label */}
        <span
          className="text-muted-foreground"
          style={{
            fontSize: "10px",
            fontWeight: "var(--font-weight-semibold)",
            lineHeight: "15px",
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
            fontFamily: FONT,
          }}
        >
          {item.currentStock > 0 ? "IN STOCK" : "OUT OF STOCK"}
        </span>

        {/* Part number + serialization badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-foreground cursor-pointer hover:text-primary transition-colors"
            style={{
              fontSize: "16px",
              fontWeight: "var(--font-weight-semibold)",
              lineHeight: "24px",
              fontFamily: FONT,
            }}
          >
            {highlight(item.itemNumber, query)}
          </span>
          {(() => {
            const hash = item.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
            const serialized = hash % 3 === 0;
            return (
              <span
                className="shrink-0"
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  lineHeight: "16px",
                  fontFamily: FONT,
                  backgroundColor: "var(--secondary)",
                  color: "var(--muted-foreground)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                }}
              >
                {serialized ? "Serialized" : "Non-Serialized"}
              </span>
            );
          })()}
        </div>

        {/* Description — highlighted for search */}
        <TruncatedItemName
          name={item.descriptiveName}
          maxChars={50}
          style={{ fontSize: "12px", fontWeight: "var(--font-weight-normal)", lineHeight: "16px" }}
          className="text-foreground"
          highlightFn={(text) => highlight(text, query)}
        />

        {/* Vendor chip + Price — same row per Figma */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="shrink-0">{vendorChipCompact}</div>
          {item.unitPrice > 0 ? (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-muted-foreground"
                style={{
                  fontSize: "9px",
                  fontWeight: "var(--font-weight-normal)",
                  lineHeight: "15px",
                  fontFamily: FONT,
                }}
              >
                Price per unit
              </span>
              <POPriceDisplay
                nativePrice={item.unitPrice * (1 - item.discount / 100)}
                vendorName={item.partnerLocation}
                className="text-foreground"
              />
              <span
                className="text-muted-foreground"
                style={{
                  fontSize: "9px",
                  fontWeight: "var(--font-weight-normal)",
                  lineHeight: "15px",
                  fontFamily: FONT,
                }}
              >
                / {formatUOM(item.defaultUOM)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
              Assign vendor for price
            </span>
          )}
        </div>

        {/* Below min / Shortage — exact same as catalogue */}
        <div className="mt-2">
          {stockInfo}
        </div>
      </div>

      {/* Right: Action buttons — same width as catalogue (138px), with Select + match badge */}
      <div className="flex flex-col items-end gap-[5px] px-3 py-3 shrink-0 w-[138px]">
        {/* Match context badge */}
        {matchLabel && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--primary-tint)",
              color: "var(--primary)",
              ...t.matchHint,
            }}
          >
            <Sparkles className="size-2.5" />
            <span className="truncate max-w-[80px]">
              {matchLabel
                .replace("Part number match", "Part #")
                .replace("Description match", "Desc.")
                .replace("Multi-keyword match", "Multi")
                .replace("Category: ", "")}
            </span>
          </span>
        )}

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />

        {/* Select / Add Item / In PO button */}
        {alreadyAdded ? (
          <span
            className="w-full flex items-center justify-center gap-1 h-[26px] rounded-[var(--radius)] border border-primary/20 bg-primary/5 text-primary"
            style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }}
          >
            <Check className="size-3" />
            In PO
          </span>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-1 h-[26px] rounded-[var(--radius)] border border-border text-foreground hover:border-primary hover:text-primary transition-all cursor-pointer"
            style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          >
            {selectLabel || "Select"}
            <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR RESULT ROW
   ═══════════════════════════════════════════════════════════════ */

function VendorResultRow({
  vendor,
  query,
  isActive,
  onSelect,
  onMouseEnter,
}: {
  vendor: VendorResult;
  query: string;
  isActive: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}) {
  const color = vendorColor(vendor.name);

  return (
    <div
      role="button"
      tabIndex={-1}
      className="group/row flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors"
      style={{
        backgroundColor: isActive ? "var(--primary-tint)" : "transparent",
      }}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
    >
      {/* Avatar */}
      <span
        className="inline-flex items-center justify-center rounded-[var(--radius-sm)] shrink-0"
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: color.bg,
          color: color.text,
          ...t.abbr,
        }}
      >
        {vendor.abbr}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="block truncate" style={{ ...t.vendorName, color: "var(--foreground)" }}>
          {highlight(vendor.name, query)}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span style={{ ...t.vendorMeta, color: "var(--muted-foreground)" }}>
            {vendor.itemCount} item{vendor.itemCount !== 1 ? "s" : ""} in catalog
          </span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span className="truncate" style={{ ...t.vendorMeta, color: "var(--muted-foreground)" }}>
            {vendor.categories.join(", ")}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div
        className="flex items-center justify-center shrink-0 size-7 rounded-[var(--radius-sm)] opacity-0 group-hover/row:opacity-100 transition-opacity"
        style={{ color: "var(--primary)" }}
      >
        <ArrowRight className="size-4" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE — search guidance
   ══════════════════════════════════════════════════════════════ */

function EmptySearchState({
  recentSearches,
  onRecentClick,
  onClearRecent,
}: {
  recentSearches: string[];
  onRecentClick: (q: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      {/* Main icon */}
      <div
        className="flex items-center justify-center size-16 rounded-full mb-5"
        style={{ backgroundColor: "var(--primary-tint)" }}
      >
        <Search className="size-7" style={{ color: "var(--primary)", opacity: 0.7 }} />
      </div>

      <span style={{ ...t.emptyTitle, color: "var(--foreground)" }}>
        Search items or vendors to get started
      </span>
      <span className="mt-1.5 text-center max-w-[340px]" style={{ ...t.emptyDesc, color: "var(--muted-foreground)" }}>
        Type a part number, item name, category, or vendor to find what you need. Results appear as you type.
      </span>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="mt-7 w-full max-w-[380px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="flex items-center gap-1.5" style={{ ...t.sectionLabel, color: "var(--muted-foreground)" }}>
              <Clock className="size-3" />
              Recent Searches
            </span>
            <button
              className="cursor-pointer transition-colors"
              style={{ ...t.matchHint, color: "var(--muted-foreground)" }}
              onClick={onClearRecent}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; }}
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((q) => (
              <button
                key={q}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--foreground)",
                  ...t.tipLabel,
                }}
                onClick={() => onRecentClick(q)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--primary-tint)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--card)";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--foreground)";
                }}
              >
                <Clock className="size-3" style={{ opacity: 0.5 }} />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search tips */}
      <div
        className="mt-7 w-full max-w-[380px] rounded-[var(--radius)] overflow-hidden"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}
        >
          <TrendingUp className="size-3" style={{ color: "var(--muted-foreground)" }} />
          <span style={{ ...t.sectionLabel, color: "var(--muted-foreground)" }}>
            Search Tips
          </span>
        </div>
        <div className="px-3.5 py-2.5 flex flex-col gap-2">
          {[
            { icon: Package, label: "Part numbers", desc: 'Try "482910" or "519374"' },
            { icon: Box, label: "Item names", desc: 'Try "brake pad" or "sensor"' },
            { icon: Tag, label: "Categories", desc: 'Try "hydraulics" or "electronics"' },
            { icon: Building2, label: "Vendor names", desc: 'Switch to Vendors and search' },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <tip.icon className="size-3 shrink-0" style={{ color: "var(--primary)", opacity: 0.7 }} />
              <span style={{ ...t.tipLabel, color: "var(--foreground)" }}>{tip.label}</span>
              <span style={{ ...t.tipDesc, color: "var(--muted-foreground)" }}>{tip.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="flex items-center gap-4 mt-6">
        <span className="flex items-center gap-1.5" style={{ ...t.tipDesc, color: "var(--muted-foreground)" }}>
          <KbdKey><CornerDownLeft className="size-2.5" /></KbdKey> Select
        </span>
        <span className="flex items-center gap-1.5" style={{ ...t.tipDesc, color: "var(--muted-foreground)" }}>
          <KbdKey><ArrowUpDown className="size-2.5" /></KbdKey> Navigate
        </span>
        <span className="flex items-center gap-1.5" style={{ ...t.tipDesc, color: "var(--muted-foreground)" }}>
          <KbdKey>Esc</KbdKey> Close
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NO RESULTS STATE
   ═══════════════════════════════════════════════════════════════ */

function NoResultsState({ query, mode }: { query: string; mode: SearchMode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      <div
        className="flex items-center justify-center size-14 rounded-full mb-4"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <Search className="size-6" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
      </div>
      <span style={{ ...t.emptyTitle, color: "var(--foreground)" }}>
        No {mode === "items" ? "items" : "vendors"} found
      </span>
      <span className="mt-1 text-center max-w-[280px]" style={{ ...t.emptyDesc, color: "var(--muted-foreground)" }}>
        No results for &ldquo;{query}&rdquo;. Try a different search term or check for typos.
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function PurchaseSearchModal({
  open,
  onOpenChange,
  onItemSelect,
  onVendorSelect,
  onBrowseCatalog,
  vendorFilter,
  keepOpenOnSelect,
  existingItemNumbers,
  selectButtonLabel,
}: PurchaseSearchModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("items");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      if (!vendorFilter) setMode("items");
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, vendorFilter]);

  const hasQuery = query.trim().length > 0;

  /* ── Build item results with scoring ── */
  const itemResults = useMemo<SearchResultItem[]>(() => {
    if (!hasQuery || mode !== "items") return [];
    const q = query.trim();

    let items = [...CATALOG];
    if (vendorFilter) {
      items = items.filter((item) => item.partnerLocation === vendorFilter);
    }

    const scored = items
      .map((item) => ({
        item,
        offers: getVendorOffersForItem(item.id),
        score: scoreItem(item, q),
        matchLabel: getMatchLabel(item, q),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    return scored;
  }, [query, mode, vendorFilter, hasQuery]);

  /* ── Build vendor results ── */
  const vendorResults = useMemo<VendorResult[]>(() => {
    if (!hasQuery || mode !== "vendors") return [];
    const q = query.trim().toLowerCase();

    return VENDOR_SUGGESTIONS
      .map((v) => {
        let score = 0;
        const nameLower = v.name.toLowerCase();
        const abbrLower = v.abbr.toLowerCase();
        if (nameLower.startsWith(q)) score = 100;
        else if (abbrLower === q) score = 90;
        else if (nameLower.includes(q)) score = 60;
        else if (abbrLower.includes(q)) score = 40;
        else {
          const tokens = q.split(/\s+/);
          if (tokens.every((tk) => nameLower.includes(tk))) score = 30;
        }
        return { ...v, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, mode, hasQuery]);

  const totalResults = mode === "items" ? itemResults.length : vendorResults.length;

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, mode]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  /* ── Handlers ── */
  const handleItemSelect = useCallback(
    (item: CatalogItem) => {
      addRecentSearch(query.trim());
      onItemSelect(item);
      if (!keepOpenOnSelect) onOpenChange(false);
    },
    [onItemSelect, onOpenChange, keepOpenOnSelect, query]
  );

  const handleVendorSelect = useCallback(
    (vendorName: string) => {
      addRecentSearch(query.trim());
      onVendorSelect(vendorName);
      onOpenChange(false);
    },
    [onVendorSelect, onOpenChange, query]
  );

  const handleRecentClick = useCallback((q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, totalResults - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && hasQuery && totalResults > 0) {
        e.preventDefault();
        if (mode === "items" && itemResults[activeIndex]) {
          handleItemSelect(itemResults[activeIndex].item);
        } else if (mode === "vendors" && vendorResults[activeIndex]) {
          handleVendorSelect(vendorResults[activeIndex].name);
        }
      } else if (e.key === "Tab" && !vendorFilter) {
        e.preventDefault();
        setMode((prev) => (prev === "items" ? "vendors" : "items"));
      }
    },
    [totalResults, hasQuery, mode, itemResults, vendorResults, activeIndex, handleItemSelect, handleVendorSelect, vendorFilter]
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden sm:max-w-none max-w-none [&>[data-slot=dialog-close]]:hidden [&>.absolute]:hidden"
        style={{
          backgroundColor: "var(--card)",
          fontFamily: FONT,
          maxWidth: "720px",
          width: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 80px)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--elevation-lg)",
          border: "1px solid var(--border)",
        }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search Items & Vendors</DialogTitle>

        {/* ━━━━━━━ SEARCH BAR ━━━━━━━ */}
        <div
          className="shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="flex items-center"
            style={{
              height: "52px",
              backgroundColor: "var(--card)",
            }}
          >
            {/* Category selector */}
            <CategorySelector
              mode={mode}
              onModeChange={(m) => {
                setMode(m);
                setQuery("");
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              disabled={!!vendorFilter}
            />

            {/* Search input */}
            <div className="flex-1 flex items-center gap-2.5 px-4 h-full min-w-0">
              <Search className="size-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  vendorFilter
                    ? `Search items from ${vendorFilter}...`
                    : mode === "items"
                    ? "Search by part number, item name, or category..."
                    : "Search vendors by name..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none min-w-0 placeholder:text-muted-foreground"
                style={{ ...t.searchInput, color: "var(--foreground)" }}
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  className="flex items-center justify-center size-5 rounded-full shrink-0 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: "var(--secondary)",
                    color: "var(--muted-foreground)",
                  }}
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--muted-foreground)";
                    e.currentTarget.style.color = "var(--card)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Tab toggle hint */}
            {!vendorFilter && (
              <div
                className="shrink-0 flex items-center gap-1.5 pr-4"
                style={{ ...t.tipDesc, color: "var(--muted-foreground)" }}
              >
                <KbdKey>Tab</KbdKey>
                <span className="hidden sm:inline">{mode === "items" ? "Vendors" : "Items"}</span>
              </div>
            )}
          </div>

          {/* Result count bar — only when there's a query */}
          {hasQuery && (
            <div
              className="flex items-center justify-between px-5 py-1.5"
              style={{
                borderTop: "1px solid var(--border)",
                backgroundColor: "var(--secondary)",
              }}
            >
              <span style={{ ...t.resultCount, color: "var(--muted-foreground)" }}>
                {totalResults} {mode === "items" ? "item" : "vendor"}{totalResults !== 1 ? "s" : ""} found
                {vendorFilter ? ` from ${vendorFilter}` : ""}
              </span>
              {totalResults > 0 && (
                <span className="flex items-center gap-1" style={{ ...t.resultCount, color: "var(--muted-foreground)" }}>
                  <Keyboard className="size-3" />
                  <ArrowUpDown className="size-3" /> to navigate
                </span>
              )}
            </div>
          )}
        </div>

        {/* ━━━━━━━ RESULTS / EMPTY STATE ━━━━━━━ */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto min-h-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
        >
          {!hasQuery ? (
            <EmptySearchState
              recentSearches={recentSearches}
              onRecentClick={handleRecentClick}
              onClearRecent={handleClearRecent}
            />
          ) : totalResults === 0 ? (
            <NoResultsState query={query} mode={mode} />
          ) : mode === "items" ? (
            <div className="py-1.5" style={{ backgroundColor: "var(--secondary)" }}>
              {itemResults.map((result, idx) => (
                <div key={result.item.id} data-index={idx}>
                  <ItemResultRow
                    result={result}
                    query={query}
                    isActive={activeIndex === idx}
                    onSelect={() => handleItemSelect(result.item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    alreadyAdded={existingItemNumbers?.includes(result.item.itemNumber)}
                    selectLabel={selectButtonLabel}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {vendorResults.map((vendor, idx) => (
                <div key={vendor.name} data-index={idx}>
                  <VendorResultRow
                    vendor={vendor}
                    query={query}
                    isActive={activeIndex === idx}
                    onSelect={() => handleVendorSelect(vendor.name)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ━━━━━━━ FOOTER ━━━━━━━ */}
        <div
          className="shrink-0 flex items-center justify-between px-5"
          style={{
            height: "48px",
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          {/* Keyboard shortcuts */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" style={{ ...t.footerText, color: "var(--muted-foreground)" }}>
              <KbdKey><CornerDownLeft className="size-2.5" /></KbdKey>
              <span className="hidden sm:inline">Select</span>
            </span>
            <span className="flex items-center gap-1" style={{ ...t.footerText, color: "var(--muted-foreground)" }}>
              <KbdKey>Esc</KbdKey>
              <span className="hidden sm:inline">Close</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-all"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                backgroundColor: "var(--card)",
                ...t.footerBtn,
              }}
              onClick={() => onOpenChange(false)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; }}
            >
              Cancel
            </button>
            {!vendorFilter && (
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-all"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  ...t.footerBtn,
                }}
                onClick={() => { onBrowseCatalog(query); onOpenChange(false); }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                Browse All Items
                <ArrowRight className="size-3" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}