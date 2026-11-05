/* ═══════════════════════════════════════════════════════════════
   ImageLightbox — Modal-style image viewer with navigation
   Uses portal + high z-index + pointer capture to work above any modal.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { FONT } from "./designTokens";

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  partNumber: string;
  itemName: string;
  initialIndex?: number;
}

export default function ImageLightbox({
  open,
  onClose,
  images,
  partNumber,
  itemName,
  initialIndex = 0,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const total = images.length;

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);

  const stableClose = useCallback(() => { onClose(); }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === "Escape") { e.preventDefault(); stableClose(); }
      if (e.key === "ArrowLeft" && total > 1) setCurrentIndex((i) => (i - 1 + total) % total);
      if (e.key === "ArrowRight" && total > 1) setCurrentIndex((i) => (i + 1) % total);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, stableClose, total]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || images.length === 0) return null;

  const stop = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.60)",
        pointerEvents: "auto",
        animation: "overlay-enter 0.2s ease-out",
      }}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={(e) => { stop(e); stableClose(); }}
    >
      {/* Modal container */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "#000000",
          borderRadius: 16,
          width: 520,
          height: 620,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          pointerEvents: "auto",
          animation: "lightbox-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          transformOrigin: "center center",
        }}
        onClick={stop}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { stop(e); stableClose(); }}
        >
          <X size={20} color="white" />
        </button>

        {/* Image area */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 0,
            paddingTop: 40,
          }}
        >
          <img
            src={images[currentIndex]}
            alt={itemName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              userSelect: "none",
            }}
            draggable={false}
          />

          {/* Left arrow */}
          {total > 1 && (
            <NavButton direction="left" onClick={(e) => { stop(e); setCurrentIndex((i) => (i - 1 + total) % total); }} />
          )}

          {/* Right arrow */}
          {total > 1 && (
            <NavButton direction="right" onClick={(e) => { stop(e); setCurrentIndex((i) => (i + 1) % total); }} />
          )}
        </div>

        {/* Info bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "16px 24px 20px",
            backgroundColor: "#000000",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
              fontFamily: FONT,
              lineHeight: "20px",
            }}
          >
            {itemName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.50)",
                fontFamily: FONT,
              }}
            >
              {partNumber}
            </span>
            {total > 1 && (
              <>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>•</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.50)",
                    fontFamily: FONT,
                  }}
                >
                  {currentIndex + 1} / {total}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Nav button sub-component ── */
function NavButton({ direction, onClick }: { direction: "left" | "right"; onClick: (e: React.MouseEvent) => void }) {
  const isLeft = direction === "left";
  return (
    <button
      style={{
        position: "absolute",
        [isLeft ? "left" : "right"]: 16,
        top: "50%",
        transform: "translateY(-50%)",
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "none",
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 10,
        pointerEvents: "auto",
        transition: "background-color 0.15s ease",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.65)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.45)"; }}
    >
      {isLeft ? <ChevronLeft size={20} color="white" /> : <ChevronRight size={20} color="white" />}
    </button>
  );
}
