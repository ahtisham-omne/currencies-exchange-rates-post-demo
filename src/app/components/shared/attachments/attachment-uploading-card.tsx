import React from "react";
import { X } from "lucide-react";

/**
 * UploadingCard — in-flight upload placeholder for the attachment grid.
 *
 * Verbatim port of the Purchase Order module's `UploadingCard`
 * (`PO-v3/src/app/components/attachments/AttachmentsTab.tsx` § 9), so an
 * upload looks and times the same in every module. Only PO's `--piw-*`
 * token prefix is swapped for the local equivalents; every dimension,
 * radius, easing and animation duration is unchanged:
 *
 *   · thumbnail area shimmers on a 1.2s linear loop
 *   · 56px ring, r=24, 4px stroke, rotated -90deg so it fills from 12
 *     o'clock, with a 160ms linear stroke-dashoffset transition
 *   · live percentage in the middle, tabular figures, 12px/700
 *   · extension badge bottom-left, cancel button top-right
 *   · two shimmering skeleton bars stand in for the file name and meta,
 *     the first with PO's pseudo-random width so a row of uploads does
 *     not look mechanically identical
 *
 * The caller owns progress and cancellation; this component only draws.
 */
export function AttachmentUploadingCard({
  fileName,
  fileSize,
  ext,
  progress,
  onCancel,
  thumbHeight = "clamp(100px, 12vw, 180px)",
}: {
  fileName: string;
  fileSize: string;
  ext: string;
  progress: number;
  onCancel: () => void;
  thumbHeight?: string;
}) {
  const shimmer =
    "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)";
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="relative flex flex-col"
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)",
      }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{
          height: thumbHeight,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          background: shimmer,
          backgroundSize: "200% 100%",
          animation: "attUploadShimmer 1.2s linear infinite",
        }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,41,0.08)" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - pct / 100)}
              style={{
                transformOrigin: "center",
                transform: "rotate(-90deg)",
                transition: "stroke-dashoffset 160ms linear",
              }}
            />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--primary)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {Math.round(pct)}%
          </span>
        </div>
        <span
          className="absolute"
          style={{
            bottom: "var(--spacing-1-5)",
            left: "var(--spacing-1-5)",
            padding: "1px var(--spacing-1)",
            borderRadius: "var(--radius-xs)",
            background: "#FFFFFF",
            border: "1px solid var(--border)",
            fontWeight: 600,
            fontSize: 9,
            color: "var(--text-secondary)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {ext}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          aria-label="Cancel upload"
          className="absolute flex items-center justify-center"
          style={{
            top: "var(--spacing-1-5)",
            right: "var(--spacing-1-5)",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            color: "var(--text-secondary)",
            boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
          }}
        >
          <X size={12} />
        </button>
      </div>
      <div
        className="flex flex-col w-full"
        style={{ padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)", gap: "var(--spacing-1-5)" }}
      >
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-body-sm) * 1.3)",
            width: `${60 + ((fileName.length * 7) % 30)}%`,
            maxWidth: "100%",
            borderRadius: 4,
            background: shimmer,
            backgroundSize: "200% 100%",
            animation: "attUploadShimmer 1.2s linear infinite",
          }}
        />
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-caption) * 1.3)",
            width: 56,
            borderRadius: 4,
            background: shimmer,
            backgroundSize: "200% 100%",
            animation: "attUploadShimmer 1.2s linear infinite",
          }}
        />
        <span className="sr-only" title={fileName}>
          {fileName} ({fileSize})
        </span>
      </div>
      <style>{`@keyframes attUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
