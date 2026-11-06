import React from "react";
import { Building2 } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   LocationThumbnail — tiny rounded square shown in the Partner
   Locations column (screenshot 5): an image when available, otherwise
   a faded mountain-style placeholder so empty rows stay legible.
   ═══════════════════════════════════════════════════════════════ */

interface LocationThumbnailProps {
  /** Image URL. If missing or it errors, the placeholder is shown. */
  imageUrl?: string;
  /** Alt text for screen readers. */
  name: string;
  /** Square edge length in px. Defaults to 28. */
  size?: number;
  /** Border radius in px. Defaults to 6. */
  radius?: number;
  className?: string;
}

export function LocationThumbnail({
  imageUrl, name, size = 28, radius = 6, className,
}: LocationThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = !!imageUrl && !failed;
  return (
    <span
      className={className}
      title={name}
      aria-label={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        background: "linear-gradient(135deg, #E2E8F0, #CBD5E1)",
        border: "1px solid #E8ECF1",
      }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <Building2 style={{ width: size * 0.45, height: size * 0.45, color: "#94A3B8" }} />
      )}
    </span>
  );
}

export default LocationThumbnail;
