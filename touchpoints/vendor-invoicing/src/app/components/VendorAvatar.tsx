import { palette } from '@/styles/tokens';
import { useState } from 'react';
import { getAvatarTint } from '@/app/utils/avatarTints';
import { userPhotoFor } from '@/app/utils/userAvatar';

interface VendorAvatarProps {
  /** Vendor display name — drives the deterministic tint + initials fallback. */
  name: string;
  /** Optional logo URL. If absent or load fails, renders the initials chip. */
  logoUrl?: string;
  /** xs (16px) fits inside compact header pills (user 10/1). */
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

function deriveInitials(name: string): string {
  if (!name) return '–';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Vendor logo / initials chip — ported from partners' `LogoAvatar`.
 * Renders a rounded square with the vendor's logo if available, or a
 * tinted initials chip otherwise. The tint is a deterministic hash of
 * the vendor name so the same vendor always gets the same color.
 */
export function VendorAvatar({ name, logoUrl, size = 'md' }: VendorAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : size === 'xs' ? 'w-4 h-4' : 'w-8 h-8';
  const textSize = size === 'lg' ? 'text-[11px]' : size === 'sm' ? 'text-[9px]' : size === 'xs' ? 'text-[7px]' : 'text-[10px]';
  // A known person's headshot (feedback 7/22/26) takes priority over a
  // logo URL and renders full-bleed (object-cover), not padded like a
  // logo mark.
  const photo = userPhotoFor(name);
  const src = photo ?? logoUrl;
  const showImg = src && !imgFailed;
  const tint = getAvatarTint(name || '–');

  // rounded-md + no border matches the partner Partners column avatar
  // exactly. When a logo URL is supplied, we keep a thin border to define
  // the white edge around the image; initials chips render edgeless.
  return (
    <div
      className={`${sizeClass} rounded-md flex items-center justify-center shrink-0 overflow-hidden ${
        showImg ? 'border border-[#E8ECF1]' : ''
      }`}
      style={{ backgroundColor: showImg ? '#FFFFFF' : tint.bg }}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          className={photo ? 'w-full h-full object-cover' : 'w-full h-full object-contain p-1.5'}
          onError={() => setImgFailed(true)}
        />
      ) : (
        // Initials use the dark foreground slate so the text is consistent
        // across every tint (matches partner Partners column treatment).
        // The deterministic tint stays on the background; only the text
        // color is unified.
        <span className={textSize} style={{ fontWeight: 700, color: palette.slate[800] }}>
          {deriveInitials(name)}
        </span>
      )}
    </div>
  );
}
