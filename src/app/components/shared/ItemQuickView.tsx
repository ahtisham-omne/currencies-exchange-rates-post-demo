import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, ZoomIn, ChevronLeft, ChevronRight, ExternalLink, Star, Layers, Package,
} from "lucide-react";
import { LotTrackingTag } from "./LotTrackingTag";
import { InactiveItemPill } from "./InactiveItemPill";

/* ════════════════════════════════════════════════════════════════
   ItemQuickView — peek modal that opens when an item thumbnail is
   tapped anywhere in the module (line-item tables, configurator,
   gallery, attachments, etc.). Mirrors the Partner item peek:

     • Hero image with status pill (top-left), zoom + close (top-right)
       and prev/next chevrons when multiple images are present.
     • SKU + primary-tag pill row.
     • Description (clamped to 3 lines, no inline more — open the
       full item if you need more).
     • 4-column metric strip (Partner / Unit Price / In Stock / Lead
       Time) — slots are skipped if the field is missing.
     • Material + UOM and on-hand / reorder rows underneath.
     • Footer: Close (left), "Go to Item ↗" primary CTA (right).
   ═══════════════════════════════════════════════════════════════ */

export interface ItemQuickViewMetric {
  label: string;
  value: string;
  /** Optional sub-label rendered under the value (e.g. "Partner"). */
  caption?: string;
}

export interface ItemQuickViewItem {
  /** SKU / item number shown as the primary heading. */
  code: string;
  /** Long-form description rendered below the SKU. */
  description?: string;
  /** Image URLs. The first is shown by default; chevrons step through. */
  images?: string[];
  /** Status pill displayed top-left over the hero image. */
  statusLabel?: string;
  /** Primary tag pill next to the SKU (e.g. "Primary: Raw Material"). */
  primaryTag?: string;
  /** Material classification (e.g. "Raw Material"). */
  material?: string;
  /** Unit of measure (e.g. "LB", "EA"). */
  uom?: string;
  /** On-hand quantity. */
  onHand?: number;
  /** Reorder threshold. */
  reorderAt?: number;
  /** Free-form metric strip. Up to 4 entries are rendered. */
  metrics?: ItemQuickViewMetric[];
}

interface ItemQuickViewProps {
  isOpen: boolean;
  item: ItemQuickViewItem | null;
  onClose: () => void;
  onGoToItem?: (item: ItemQuickViewItem) => void;
}

export function ItemQuickView({ isOpen, item, onClose, onGoToItem }: ItemQuickViewProps) {
  const [imageIdx, setImageIdx] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setImageIdx(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!item?.images?.length) return;
      if (e.key === "ArrowLeft") setImageIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setImageIdx((i) => Math.min((item.images?.length ?? 1) - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, item, onClose]);

  if (!isOpen || !item) return null;

  const images = item.images ?? [];
  const hasMultiple = images.length > 1;
  const currentImage = images[imageIdx];

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 12300, backgroundColor: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`Quick view: ${item.code}`}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          zIndex: 12301,
          width: "min(92vw, 480px)",
          maxHeight: "92vh",
          background: "var(--card)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero image */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1.4 / 1",
            background: "#0F172A",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {currentImage ? (
            <img
              src={currentImage}
              alt={item.code}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              draggable={false}
            />
          ) : (
            <div
              className="flex items-center justify-center"
              style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1F2937, #0F172A)" }}
            >
              <Package style={{ width: 56, height: 56, color: "rgba(255,255,255,0.18)" }} />
            </div>
          )}

          {/* Top-left status pill */}
          {item.statusLabel && (
            <span
              className="inline-flex items-center"
              style={{
                position: "absolute", top: 12, left: 12,
                gap: 6, height: 26, padding: "0 12px", borderRadius: 999,
                background: "rgba(255, 255, 255, 0.92)",
                color: "#0F172A",
                fontSize: 12, fontWeight: 600,
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.18)",
                backdropFilter: "blur(4px)",
              }}
            >
              {item.statusLabel}
            </span>
          )}

          {/* Top-right zoom + close */}
          <div className="flex items-center" style={{ position: "absolute", top: 12, right: 12, gap: 6 }}>
            <button
              type="button"
              aria-label="Zoom"
              className="inline-flex items-center justify-center"
              style={{
                width: 32, height: 32, borderRadius: 999,
                border: "none", cursor: "pointer",
                background: "rgba(255, 255, 255, 0.92)",
                color: "#0F172A",
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.18)",
              }}
            >
              <ZoomIn style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex items-center justify-center"
              style={{
                width: 32, height: 32, borderRadius: 999,
                border: "none", cursor: "pointer",
                background: "rgba(255, 255, 255, 0.92)",
                color: "#0F172A",
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.18)",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Image carousel chevrons */}
          {hasMultiple && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => setImageIdx((i) => Math.max(0, i - 1))}
                disabled={imageIdx === 0}
                className="inline-flex items-center justify-center"
                style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  width: 32, height: 32, borderRadius: 999,
                  border: "none",
                  cursor: imageIdx === 0 ? "default" : "pointer",
                  opacity: imageIdx === 0 ? 0.4 : 1,
                  background: "rgba(255, 255, 255, 0.85)",
                  color: "#0F172A",
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.20)",
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => setImageIdx((i) => Math.min(images.length - 1, i + 1))}
                disabled={imageIdx === images.length - 1}
                className="inline-flex items-center justify-center"
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  width: 32, height: 32, borderRadius: 999,
                  border: "none",
                  cursor: imageIdx === images.length - 1 ? "default" : "pointer",
                  opacity: imageIdx === images.length - 1 ? 0.4 : 1,
                  background: "rgba(255, 255, 255, 0.85)",
                  color: "#0F172A",
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.20)",
                }}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
              {/* Dots */}
              <div
                className="flex items-center"
                style={{
                  position: "absolute", bottom: 10, right: 12,
                  gap: 4, padding: "3px 8px", borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.55)",
                }}
              >
                {images.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: i === imageIdx ? 10 : 5, height: 5, borderRadius: 999,
                      background: i === imageIdx ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                      transition: "width 150ms ease",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 18 }}>
          {/* SKU + primary tag */}
          <div className="flex items-center" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", letterSpacing: -0.2 }}>{item.code}</span>
            {item.primaryTag && (
              item.primaryTag === 'Lot Serialized' ? (
                <LotTrackingTag type="serialized" />
              ) : item.primaryTag === 'Lot Non-Serialized' ? (
                <LotTrackingTag type="non-serialized" />
              ) : (
                <span
                  className="inline-flex items-center whitespace-nowrap"
                  style={{
                    gap: 6, padding: "2px 10px", borderRadius: 9999,
                    border: "1px solid #CBD5E1", background: "#F1F5F9",
                    color: "#475569", fontSize: 11, fontWeight: 500, lineHeight: 1.4,
                  }}
                >
                  <Star style={{ width: 11, height: 11, color: "#F59E0B", fill: "#F59E0B" }} />
                  {item.primaryTag}
                </span>
              )
            )}
            {/* Record status after the primary tag: Partners' item
                QuickView chip, Active or Inactive, as PO places it. */}
            <InactiveItemPill code={item.code} variant="chip" showActive noun="order" />
          </div>

          {/* Description */}
          {item.description && (
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "#475569",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }}
            >
              {item.description}
            </p>
          )}

          {/* Metric strip — up to 4 cells */}
          {item.metrics && item.metrics.length > 0 && (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${Math.min(4, item.metrics.length)}, minmax(0, 1fr))`,
                marginBottom: 14,
                border: "1px solid #E8ECF1",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--card)",
              }}
            >
              {item.metrics.slice(0, 4).map((m, i, arr) => (
                <div
                  key={m.label}
                  style={{
                    padding: "10px 12px",
                    borderRight: i < arr.length - 1 ? "1px solid #EEF2F6" : "none",
                    display: "flex", flexDirection: "column", gap: 2,
                    minWidth: 0,
                  }}
                >
                  <span
                    className="truncate"
                    style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}
                    title={m.value}
                  >
                    {m.value}
                  </span>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>
                    {m.caption ?? m.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Material + UOM */}
          {(item.material || item.uom) && (
            <div className="flex items-center" style={{ gap: 8, marginBottom: 6, fontSize: 12, color: "#475569" }}>
              <Layers style={{ width: 13, height: 13, color: "#94A3B8" }} />
              {item.material && <span style={{ fontWeight: 500 }}>{item.material}</span>}
              {item.material && item.uom && <span style={{ color: "#CBD5E1" }}>·</span>}
              {item.uom && <span>{item.uom}</span>}
            </div>
          )}

          {/* On-hand + reorder */}
          {(item.onHand !== undefined || item.reorderAt !== undefined) && (
            <div className="flex items-center" style={{ gap: 8, fontSize: 12, color: "#475569" }}>
              <Package style={{ width: 13, height: 13, color: "#94A3B8" }} />
              {item.onHand !== undefined && (
                <span>
                  <span style={{ fontWeight: 500 }}>On-Hand: </span>
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>{item.onHand.toLocaleString()}</span>
                </span>
              )}
              {item.onHand !== undefined && item.reorderAt !== undefined && <span style={{ color: "#CBD5E1" }}>·</span>}
              {item.reorderAt !== undefined && <span>Reorder at {item.reorderAt.toLocaleString()}</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "12px 18px", borderTop: "1px solid #EEF2F6",
            background: "var(--card)", flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 34, padding: "0 14px", border: "none", background: "transparent",
              color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { if (onGoToItem) onGoToItem(item); else onClose(); }}
            className="inline-flex items-center"
            style={{
              height: 34, padding: "0 14px", borderRadius: 8, border: "none",
              background: "var(--primary)", color: "#FFFFFF",
              fontSize: 13, fontWeight: 600, gap: 6, cursor: "pointer",
            }}
          >
            Go to Item <ExternalLink style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ════════════════════════════════════════════════════════════════
   useItemQuickView — convenience hook so callers don't need to
   thread `isOpen` / `item` state through their own component tree:

     const { open, modal } = useItemQuickView({ onGoToItem });
     // ...
     <button onClick={() => open(thumbItem)}><img ... /></button>
     {modal}
   ═══════════════════════════════════════════════════════════════ */

export function useItemQuickView(opts?: { onGoToItem?: (item: ItemQuickViewItem) => void }) {
  const [item, setItem] = useState<ItemQuickViewItem | null>(null);
  const open = (i: ItemQuickViewItem) => setItem(i);
  const close = () => setItem(null);
  const modal = (
    <ItemQuickView
      isOpen={item !== null}
      item={item}
      onClose={close}
      onGoToItem={opts?.onGoToItem}
    />
  );
  return { item, open, close, modal };
}

export default ItemQuickView;
