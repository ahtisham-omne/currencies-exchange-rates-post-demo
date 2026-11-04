import { useState } from "react";
import { palette } from '@/styles/tokens';
import { userPhotoFor } from '@/app/utils/userAvatar';

const AVATAR_TINTS = [
  { bg: "hsl(var(--accent))", fg: "hsl(var(--primary))" },
  { bg: palette.green[50], fg: palette.green[600] },
  { bg: palette.orange[50], fg: palette.orange[600] },
  { bg: palette.violet[50], fg: "hsl(var(--violet))" },
  { bg: palette.cyan[50], fg: palette.cyan[600] },
  { bg: palette.rose[50], fg: palette.rose[600] },
  { bg: palette.yellow[100], fg: palette.yellow[700] },
  { bg: palette.teal[50], fg: palette.teal[600] },
  { bg: palette.pink[50], fg: palette.pink[600] },
  { bg: palette.blue[50], fg: palette.blue[600] },
  { bg: "#F5F5F4", fg: "#57534E" },
];

export function getAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % AVATAR_TINTS.length;
  return AVATAR_TINTS[idx];
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<Size, { box: number; text: string }> = {
  xs: { box: 20, text: "9px" },
  sm: { box: 24, text: "10px" },
  md: { box: 28, text: "11px" },
  lg: { box: 40, text: "13px" },
};

/** Deterministic randomuser API portrait URL — same name always returns the
 *  same person photo. Mirrors partner module's `getPersonAvatar` so the
 *  Created By avatars look consistent between the two apps. */
export function getPersonPhotoUrl(name: string): string {
  if (!name) return "";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const idx = (Math.abs(h) % 99) + 1;
  const gender = h % 2 === 0 ? "men" : "women";
  return `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;
}

interface PersonAvatarProps {
  name: string;
  size?: Size;
  /** Avatar shape — "square" matches partner's Partners column, "circle"
   *  matches partner's Created By column. */
  shape?: "square" | "circle";
  /** Override the deterministic tint */
  bg?: string;
  fg?: string;
  /** Override initials (otherwise computed from name) */
  initials?: string;
  className?: string;
}

/** Deterministically-tinted person avatar with initials.
 *  Matches partner module's avatar style — `shape="circle"` is used in the
 *  Created By column, `shape="square"` (default) in entity columns.
 *
 *  By default the initials text renders in a unified dark slate so they
 *  read consistently across all tints (matches partner's treatment).
 *  Pass explicit `fg` to override (e.g. inverted text on dark badges). */
export function PersonAvatar({
  name,
  size = "sm",
  shape = "square",
  bg,
  fg,
  initials,
  className = "",
}: PersonAvatarProps) {
  const tint = bg && fg ? { bg, fg } : getAvatarTint(name);
  const text = initials ?? initialsFromName(name);
  const dims = SIZE_PX[size];
  const radius = shape === "circle" ? "rounded-full" : "rounded-md";
  // When caller passes explicit fg, honor it; otherwise force dark slate
  // so initials text reads uniformly on any pastel background.
  const textColor = fg ?? palette.slate[800];
  // A known person's headshot replaces the initials chip (feedback 7/22/26).
  const photo = userPhotoFor(name);
  return (
    <div
      className={`${radius} flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: dims.box,
        height: dims.box,
        backgroundColor: tint.bg,
        color: textColor,
        fontSize: dims.text,
        fontWeight: 600,
      }}
    >
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : text}
    </div>
  );
}

interface PhotoPersonAvatarProps {
  name: string;
  size?: Size;
  /** Photo URL override. Defaults to a deterministic randomuser portrait
   *  derived from the name. */
  photoUrl?: string;
  className?: string;
}

/** Real-person avatar — circular, loads a deterministic photo for the given
 *  name and falls back to the tinted initials chip if the image fails. Used
 *  in the Created By column so it matches the partner module's avatar
 *  treatment for contacts that have a real headshot. */
export function PhotoPersonAvatar({
  name,
  size = "sm",
  photoUrl,
  className = "",
}: PhotoPersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const tint = getAvatarTint(name);
  const text = initialsFromName(name);
  const dims = SIZE_PX[size];
  // A known person's real headshot wins over the deterministic portrait.
  const url = photoUrl ?? userPhotoFor(name) ?? getPersonPhotoUrl(name);
  const showImg = !!url && !failed;
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: dims.box,
        height: dims.box,
        backgroundColor: tint.bg,
        // Initials text rendered in dark slate (uniform across tints) when
        // the photo fails to load — matches Vendor avatar treatment.
        color: palette.slate[800],
        fontSize: dims.text,
        fontWeight: 600,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        text
      )}
    </div>
  );
}
