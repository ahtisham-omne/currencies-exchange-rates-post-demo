import { useState } from "react";
import { usePersonLightbox } from "./PersonAvatarLightbox";

/**
 * Multi-purpose avatar — renders a logo image, person photo, or initials fallback.
 *
 * - `type="logo"`  (default): square rounded-lg with `object-contain` and 1.5px padding.
 * - `type="person"`: circular with `object-cover`. When `personName` is provided, click opens
 *   the global PersonAvatarLightbox (must be wrapped in `<PersonAvatarLightboxProvider>`).
 *
 * Falls back to bold initials on a colored background when `logoUrl` is missing or fails to load.
 *
 * Copied verbatim from Partner Management — keep API and styling identical so devs maintain
 * a single design contract across modules.
 */
export function LogoAvatar({
  logoUrl,
  initials,
  bg,
  size = "md",
  type = "logo",
  personName,
}: {
  logoUrl?: string;
  initials: string;
  bg: string;
  size?: "sm" | "md" | "lg";
  type?: "logo" | "person";
  personName?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { openLightbox } = usePersonLightbox();
  const sizeClass = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]";
  const showImg = logoUrl && !imgFailed;
  const isPerson = type === "person";
  const canLightbox = isPerson && showImg && personName;
  return (
    <div
      className={`${sizeClass} ${isPerson ? "rounded-full" : "rounded-lg"} flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] ${canLightbox ? "cursor-zoom-in" : ""}`}
      style={{ backgroundColor: showImg ? (isPerson ? "transparent" : "#FFFFFF") : bg }}
      onClick={
        canLightbox
          ? (e) => {
              e.stopPropagation();
              openLightbox({ src: logoUrl!, name: personName! });
            }
          : undefined
      }
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt=""
          className={`w-full h-full ${isPerson ? "object-cover" : "object-contain p-1.5"}`}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={`${textSize} text-slate-700`} style={{ fontWeight: 700 }}>
          {initials}
        </span>
      )}
    </div>
  );
}
