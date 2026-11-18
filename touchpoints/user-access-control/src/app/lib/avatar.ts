import { USER_AVATAR_MAP } from "../data/user-avatars";
import { users } from "../data/users-data";
import { isMe } from "../data/current-user";

/** The logged-in user's avatar is always blue, whatever their name hashes to,
 *  so "me" is recognisable at a glance in any list of people.
 *
 *  A step deeper than the blue in the rotation below on purpose: that one is
 *  still handed out by the hash (Autumn Myers draws it), so reusing it would
 *  make "me" indistinguishable from whoever happens to collide. Reserving a
 *  shade outside the palette keeps the signal without reshuffling everyone
 *  else's colour, which is what removing an entry from TINTS would do. */
const ME_TINT = { bg: "#BFDBFE", fg: "#1E3A8A" } as const;

/* ─── Avatar color tints (deterministic per name via hash) ─── */
const TINTS = [
  { bg: "#DBEAFE", fg: "#1E40AF" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#FFEDD5", fg: "#9A3412" },
  { bg: "#CFFAFE", fg: "#155E75" },
  { bg: "#FEE2E2", fg: "#991B1B" },
];

export function getAvatarTint(name: string) {
  if (isMe(name)) return ME_TINT;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/* ─── Single source of truth for user avatar photo lookup ───
 * Resolves a photo URL for a user by ID first, then by full name.
 * Ensures the same user shows the same avatar across every UAC surface,
 * even when callers only have a name string (e.g. invitedBy, requestedBy).
 */
const NAME_TO_AVATAR: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const u of users) {
    const photo = USER_AVATAR_MAP[u.id];
    if (photo) map[u.fullName.toLowerCase()] = photo;
  }
  return map;
})();

export function resolveUserAvatar(opts: {
  userId?: number;
  name?: string;
  explicit?: string;
}): string | undefined {
  if (opts.explicit) return opts.explicit;
  if (opts.userId != null) {
    const byId = USER_AVATAR_MAP[opts.userId];
    if (byId) return byId;
  }
  if (opts.name) {
    const byName = NAME_TO_AVATAR[opts.name.toLowerCase()];
    if (byName) return byName;
  }
  return undefined;
}
