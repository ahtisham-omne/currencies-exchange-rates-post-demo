/** Consistent pastel avatar tint from a name string */
export const AVATAR_TINTS = [
  { bg: "hsl(var(--accent))", fg: "hsl(var(--primary))" }, // blue
  { bg: "#F0FDF4", fg: "#16A34A" }, // green
  { bg: "#FFF7ED", fg: "#EA580C" }, // orange
  { bg: "#F5F3FF", fg: "hsl(var(--violet))" }, // violet
  { bg: "#ECFEFF", fg: "#0891B2" }, // cyan
  { bg: "#FFF1F2", fg: "#E11D48" }, // rose
  { bg: "#FEF9C3", fg: "#A16207" }, // amber
  { bg: "#F0FDFA", fg: "#0D9488" }, // teal
  { bg: "#FDF2F8", fg: "#DB2777" }, // pink
  { bg: "#EFF6FF", fg: "#2563EB" }, // indigo
  { bg: "#F5F5F4", fg: "#57534E" }, // stone
];

export function getAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % AVATAR_TINTS.length;
  return AVATAR_TINTS[idx];
}
