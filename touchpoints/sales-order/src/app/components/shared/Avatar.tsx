import React from "react";
import { getAvatarTint } from "@/app/components/so/avatarTints";

/* Avatar — round contact chip.
   Mirrors Partner v7 LogoAvatar (person mode): tint bg from the
   shared avatarTints palette, slate-700 initials, hairline border. */

export type AvatarSize = number;
export type AvatarTone = "pastel" | "solid";

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: AvatarSize;
  initials?: string;
  tone?: AvatarTone;
  ring?: "none" | "primary" | "border";
  className?: string;
  title?: string;
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
  const tint = getAvatarTint(name);
  const text = initials ?? deriveInitials(name);

  const fontSize =
    size <= 18 ? 8 :
    size <= 22 ? 9 :
    size <= 28 ? 10 :
    size <= 36 ? 11 :
    Math.round(size * 0.32);

  const isSolid = tone === "solid";
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
    background: isSolid ? "#4338CA" : tint.bg,
    color: isSolid ? "#FFFFFF" : "#334155",
    border: isSolid ? "none" : "1px solid #E8ECF1",
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
