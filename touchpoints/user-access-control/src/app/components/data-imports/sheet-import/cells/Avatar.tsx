import React from "react";

/* ════════════════════════════════════════════════════════════════
   Avatar — single source of truth for round user/contact chips.

   Mirrors the Partner module pattern from screenshot 3:
     • Round (50%), pastel tinted background, darker tinted text.
     • Hash-color-by-name so the same person keeps the same swatch
       regardless of where they appear in the UI.
     • Optional image override; falls back to initials if the URL
       fails (or isn't supplied).
     • Optional `tone="solid"` for the current-user / brand swatch
       used in screenshot 4 (indigo fill, white initials).

   Sizes follow the Partner grid: 18 / 22 / 28 / 32 px. Pass an
   explicit `size` to opt into another value.
   ═══════════════════════════════════════════════════════════════ */

export type AvatarSize = number;
export type AvatarTone = "pastel" | "solid";

interface AvatarProps {
  name: string;
  /** Optional photo URL. If it errors, the chip falls back to initials. */
  imageUrl?: string;
  /** Diameter in px. Defaults to 28. */
  size?: AvatarSize;
  /** Override the rendered initials (otherwise derived from `name`). */
  initials?: string;
  /** Pastel = list/sidebar default. Solid = current-user / brand chip. */
  tone?: AvatarTone;
  /** Optional ring/border. Use `"primary"` for active state. */
  ring?: "none" | "primary" | "border";
  className?: string;
  title?: string;
}

const PASTEL_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#FEF3C7", fg: "#B45309" }, // amber
  { bg: "#DBEAFE", fg: "#1E40AF" }, // blue
  { bg: "#DCFCE7", fg: "#166534" }, // green
  { bg: "#FED7AA", fg: "#9A3412" }, // orange
  { bg: "#FCE7F3", fg: "#9D174D" }, // pink
  { bg: "#E0E7FF", fg: "#3730A3" }, // indigo
  { bg: "#CFFAFE", fg: "#155E75" }, // cyan
  { bg: "#FECACA", fg: "#991B1B" }, // red
  { bg: "#F3E8FF", fg: "#6B21A8" }, // purple
  { bg: "#D1FAE5", fg: "#065F46" }, // emerald
  { bg: "#E2E8F0", fg: "#334155" }, // slate
];

function hashIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
    h |= 0;
  }
  return Math.abs(h) % PASTEL_PALETTE.length;
}

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  imageUrl,
  size = 28,
  initials,
  tone = "pastel",
  ring = "none",
  className,
  title,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = !!imageUrl && !imgFailed;
  const swatch = PASTEL_PALETTE[hashIndex(name)];
  const text = initials ?? deriveInitials(name);

  // Font size scales with diameter — keep the proportions consistent
  // across the Partner size grid.
  const fontSize =
    size <= 18 ? 8 :
    size <= 22 ? 9 :
    size <= 28 ? 11 :
    size <= 36 ? 13 :
    Math.round(size * 0.38);

  const palette = tone === "solid"
    ? { bg: "#4338CA", fg: "#FFFFFF" }
    : swatch;

  const ringStyle: React.CSSProperties =
    ring === "primary"
      ? { boxShadow: "0 0 0 2px rgba(27, 110, 243, 0.45)" }
      : ring === "border"
      ? { boxShadow: "0 0 0 1px var(--border)" }
      : {};

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: 700,
    fontSize,
    lineHeight: 1,
    letterSpacing: 0.2,
    background: palette.bg,
    color: palette.fg,
    ...ringStyle,
  };

  return (
    <span
      className={className}
      style={baseStyle}
      title={title ?? name}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        text
      )}
    </span>
  );
}

export default Avatar;
