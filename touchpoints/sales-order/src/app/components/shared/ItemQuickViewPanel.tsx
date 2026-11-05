import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ChevronLeft, ChevronRight, Layers, Warehouse as WarehouseIcon, ExternalLink, Star } from "lucide-react";
import { itemListPrice } from "@/app/components/so/soMoney";

/**
 * Item Quick View — Partner v7 item-lightbox parity.
 *
 * Opens as a centered modal when a user taps an item thumbnail in the
 * listing items column. Shows a faux image carousel header, status badge,
 * item code + Primary classification, description, a 4-card metric strip
 * (Partner / Unit Price / In Stock / Lead Time), and a footer with a
 * primary "Go to Item" CTA.
 *
 * This is a slim, item-only variant of Partner's QuickViewPanel — the SO
 * module doesn't need the location / contact / carrier branches that the
 * full panel in Partner / Quote ships.
 */

export interface ItemQuickViewData {
  code: string;
  name: string;
  description: string;
  category: string;
  uom: string;
  unitPrice: number;
  onHand: number;
  reorderAt: number;
  leadTimeDays: number;
  status: string;
  partner: string;
  /** Background tint used by the thumbnail in the listing — re-used for the gallery placeholder so the lightbox feels continuous with the row. */
  tint: string;
}

const STATUS_TOKENS: Record<string, { bg: string; fg: string; border: string }> = {
  "In Stock": { bg: "#F0FDF4", fg: "#166534", border: "#BBF7D0" },
  "Low Stock": { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" },
  "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA" },
  "On Order": { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
};

interface Props {
  data: ItemQuickViewData | null;
  onClose: () => void;
  /** Optional handler when the user clicks "Go to Item". */
  onGoToItem?: (data: ItemQuickViewData) => void;
}

export function ItemQuickViewPanel({ data, onClose, onGoToItem }: Props) {
  useEffect(() => {
    if (!data) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data, onClose]);

  if (!data) return null;

  const status = STATUS_TOKENS[data.status] || STATUS_TOKENS["In Stock"];

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${data.code} — quick view`}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(540px, 100%)",
          maxHeight: "calc(100dvh - 32px)",
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* ── Image area ─────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            height: 320,
            background: `radial-gradient(circle at 50% 60%, ${data.tint} 0%, #CBD5E1 110%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {/* Status badge — top-left */}
          <span
            style={{
              position: "absolute", top: 14, left: 14,
              display: "inline-flex", alignItems: "center",
              padding: "4px 10px", borderRadius: 999,
              backgroundColor: "#FFFFFF",
              fontSize: 11, fontWeight: 600,
              color: status.fg,
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            {data.status}
          </span>
          {/* Top-right controls */}
          <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6 }}>
            <button
              type="button"
              aria-label="Zoom image"
              style={{
                width: 28, height: 28, borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.95)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ZoomIn className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.95)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X className="w-3.5 h-3.5" style={{ color: "#475569" }} />
            </button>
          </div>
          {/* Carousel arrows */}
          <button
            type="button"
            aria-label="Previous image"
            style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: 999,
              backgroundColor: "rgba(15, 23, 42, 0.5)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "#FFFFFF" }} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: 999,
              backgroundColor: "rgba(15, 23, 42, 0.5)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: "#FFFFFF" }} />
          </button>
          {/* Carousel dots */}
          <div style={{ position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)", display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: i === 0 ? 18 : 6, height: 6, borderRadius: 999,
                  backgroundColor: i === 0 ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Code + Primary badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", letterSpacing: "-0.01em" }}>{data.code}</span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 999,
                border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC",
                fontSize: 11, fontWeight: 500, color: "#475569",
              }}
            >
              <Star className="w-3 h-3" style={{ color: "#64748B" }} />
              Primary: {data.category}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "#475569", margin: 0, marginBottom: 14 }}>
            {data.description}
          </p>

          {/* Metric strip */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8, marginBottom: 14,
              border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderRight: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={data.partner}>{data.partner}</div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>Partner</div>
            </div>
            <div style={{ padding: "10px 12px", borderRight: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{itemListPrice(data.unitPrice)}</div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>Unit Price</div>
            </div>
            <div style={{ padding: "10px 12px", borderRight: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{data.onHand.toLocaleString()}</span>
                <span style={{ fontSize: 10.5, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>{data.uom}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>In Stock</div>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{data.leadTimeDays}</span>
                <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 500 }}>days</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>Lead Time</div>
            </div>
          </div>

          {/* Meta rows */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#475569", marginBottom: 6 }}>
            <Layers className="w-3.5 h-3.5" style={{ color: "#94A3B8", flexShrink: 0 }} />
            <span>{data.category}</span>
            <span style={{ color: "#CBD5E1" }}>·</span>
            <span>{data.uom}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#475569" }}>
            <WarehouseIcon className="w-3.5 h-3.5" style={{ color: "#94A3B8", flexShrink: 0 }} />
            <span>On-Hand: <b style={{ color: "#0F172A" }}>{data.onHand.toLocaleString()}</b></span>
            <span style={{ color: "#CBD5E1" }}>·</span>
            <span style={{ color: "#94A3B8" }}>Reorder at {data.reorderAt.toLocaleString()}</span>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid #E2E8F0",
            backgroundColor: "#FFFFFF",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13, fontWeight: 500, color: "#475569",
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 10px", borderRadius: 8,
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onGoToItem?.(data)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 16px", borderRadius: 8,
              backgroundColor: "#0A77FF", color: "#FFFFFF",
              fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer",
            }}
          >
            Go to Item
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
