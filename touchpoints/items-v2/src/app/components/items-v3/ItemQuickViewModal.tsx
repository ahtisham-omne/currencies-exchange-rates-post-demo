/**
 * ItemQuickViewModal — Items-side port of Partners' QuickViewPanel ItemQuickView.
 *
 * Visual parity with `Partner Management - Vendors` → `QuickViewPanel.tsx`:
 * dark image carousel hero + status pill + zoom + chevrons + dot indicators,
 * then a data block: code + category pill, description, 4-col stat cards,
 * and detail rows. Works off the real `Item` shape from `ItemsContext`.
 *
 * Trigger anywhere via the imperative hook:
 *   const { open, modal } = useItemQuickView();
 *   <button onClick={() => open(item)}>...</button>
 *   {modal}
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Star,
  Layers,
  Warehouse,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Factory,
} from "lucide-react";
import type { Item } from "@/app/context/ItemsContext";

/* ── Status palette (mirrors Partners STATUS_COLORS) ─────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  "In Stock": { bg: "#F0FDF4", fg: "#166534", border: "#BBF7D0" },
  "Low Stock": { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" },
  "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA" },
  "On Order": { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
  "Discontinued": { bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1" },
};

/* ── Number formatter ────────────────────────────────────────────────────── */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/* ── Acquisition method as a string ──────────────────────────────────────── */
function acquisitionStr(am: Item["acquisitionMethod"]): string {
  if (typeof am === "string") return am;
  if (am && typeof am === "object") return am.primary || am.methods?.[0] || "—";
  return "—";
}

/* ── Modal body ──────────────────────────────────────────────────────────── */
function ItemQuickViewBody({ item }: { item: Item }) {
  const photos = item.images?.filter(Boolean) ?? [];
  const [photoIdx, setPhotoIdx] = useState(0);
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS["In Stock"];
  const currentPhoto = photos[photoIdx % Math.max(photos.length, 1)];

  return (
    <>
      {/* Image carousel — responsive height */}
      <div
        className="relative overflow-hidden bg-[#0C1222] select-none shrink-0"
        style={{ height: "clamp(200px, 45vh, 420px)" }}
      >
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={item.description || item.partNumber}
            className="w-full h-full object-cover transition-opacity duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}

        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* Status pill — top-left */}
        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{
            fontWeight: 600,
            backgroundColor: sc.bg + "E6",
            color: sc.fg,
            borderColor: sc.border,
          }}
        >
          {item.status}
        </span>

        {/* Zoom button — top-right (offset from close) */}
        {currentPhoto && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(currentPhoto, "_blank", "noopener");
            }}
            className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
            aria-label="Open image"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}

        {/* Prev / Next arrows */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)
              }
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhotoIdx((prev) => (prev + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dot indicators — bottom-right */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === photoIdx ? "bg-white w-3" : "bg-white/40 hover:bg-white/60 w-1.5"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Data area */}
      <div className="px-5 pt-4 pb-4">
        {/* Part number + primary category pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[15px] font-mono text-foreground"
            style={{ fontWeight: 700 }}
          >
            {item.partNumber}
          </span>
          {item.primaryCategory && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
              style={{
                fontWeight: 500,
                backgroundColor: "hsl(var(--muted))",
                color: "hsl(var(--muted-foreground))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <Star className="w-3 h-3" />
              Primary: {item.primaryCategory}
            </span>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <p
            className="text-[13px] text-muted-foreground mt-2 leading-relaxed line-clamp-3"
            style={{ fontWeight: 400 }}
          >
            {item.description}
          </p>
        )}

        {/* 4-column stat cards */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div
              className="text-[15px] text-foreground"
              style={{ fontWeight: 700 }}
            >
              {fmt(item.onHandQty)}
              <span className="text-[11px] text-slate-500 ml-0.5">{item.unit}</span>
            </div>
            <div
              className="text-[10px] text-slate-400 mt-0.5"
              style={{ fontWeight: 500 }}
            >
              On-Hand
            </div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div
              className="text-[13px] text-foreground truncate"
              style={{ fontWeight: 700 }}
            >
              {item.inventoryControlType || "—"}
            </div>
            <div
              className="text-[10px] text-slate-400 mt-0.5"
              style={{ fontWeight: 500 }}
            >
              Control
            </div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div
              className="text-[13px] text-foreground truncate"
              style={{ fontWeight: 700 }}
            >
              {acquisitionStr(item.acquisitionMethod)}
            </div>
            <div
              className="text-[10px] text-slate-400 mt-0.5"
              style={{ fontWeight: 500 }}
            >
              Acquisition
            </div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div
              className="text-[13px] text-foreground truncate"
              style={{ fontWeight: 700 }}
            >
              {item.manufacturer || "—"}
            </div>
            <div
              className="text-[10px] text-slate-400 mt-0.5"
              style={{ fontWeight: 500 }}
            >
              Manufacturer
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2.5 py-0.5">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span
              className="text-[13px] text-slate-700"
              style={{ fontWeight: 500 }}
            >
              {item.primaryCategory || "—"}
            </span>
            {item.additionalCategories?.length ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500 truncate">
                  {item.additionalCategories.join(", ")}
                </span>
              </>
            ) : null}
          </div>
          {item.mpn && (
            <div className="flex items-center gap-2.5 py-0.5">
              <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[13px] text-slate-700">
                MPN: <b>{item.mpn}</b>
              </span>
            </div>
          )}
          {item.inboundLocations?.[0] && (
            <div className="flex items-center gap-2.5 py-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[13px] text-slate-700 truncate">
                {item.inboundLocations[0]}
              </span>
              {item.inboundLocations.length > 1 && (
                <span className="text-[11px] text-slate-400 shrink-0">
                  +{item.inboundLocations.length - 1} more
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2.5 py-0.5">
            <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700">
              On-Hand: <b>{fmt(item.onHandQty)}</b> {item.unit}
            </span>
            {item.alternativeStockingUnits && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500">
                  Alt: {item.alternativeStockingUnits}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Modal shell ─────────────────────────────────────────────────────────── */
export interface ItemQuickViewModalProps {
  item: Item | null;
  onClose: () => void;
  onNavigate?: (item: Item) => void;
}

export function ItemQuickViewModal({ item, onClose, onNavigate }: ItemQuickViewModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!item) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [item, handleKeyDown]);

  if (!item) return null;

  const goTo = () => {
    if (onNavigate) onNavigate(item);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50"
        style={{ animation: "itemQuickViewOverlay 200ms ease-out forwards" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
          animation: "itemQuickViewIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <ItemQuickViewBody item={item} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={goTo}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-primary-foreground bg-primary hover:opacity-90 transition-opacity cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Go to Item
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── Convenience hook ────────────────────────────────────────────────────── */
import { useNavigate } from "react-router-dom";

export function useItemQuickView() {
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const navigate = useNavigate();

  const open = useCallback((item: Item) => setOpenItem(item), []);
  const close = useCallback(() => setOpenItem(null), []);

  const modal = (
    <ItemQuickViewModal
      item={openItem}
      onClose={close}
      onNavigate={(it) => navigate(`/items/${it.id}`)}
    />
  );

  return { open, close, modal, openItem };
}