import registry from "../../touchpoints/touchpoints.json";

/* Touchpoints are separate Vite apps (see /touchpoints) served under
   /touchpoint-apps/<slug>/. Each one is mounted at a URL prefix of this app:
   a shell path is `mount + appPath`, e.g. /inventory/items ↔ items-v2 /items. */
export interface Touchpoint {
  slug: string;
  label: string;
  mount: string;
  /** Shell path prefixes this touchpoint owns (defaults to its mount). */
  prefixes: string[];
}

export interface TouchpointMatch {
  touchpoint: Touchpoint;
  appPath: string;
}

export const touchpoints: Touchpoint[] = registry.map((t) => ({
  slug: t.slug,
  label: t.label,
  mount: t.mount,
  prefixes: "prefixes" in t ? t.prefixes : [t.mount],
}));

/* Longest prefix first, so /sales/quotes wins over /sales. */
const owners = touchpoints
  .flatMap((touchpoint) => touchpoint.prefixes.map((prefix) => ({ prefix, touchpoint })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

export const touchpointPrefixes = owners.map((o) => o.prefix);

export function matchTouchpoint(pathname: string): TouchpointMatch | null {
  const owner = owners.find(({ prefix }) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!owner) return null;
  const { touchpoint } = owner;
  return { touchpoint, appPath: pathname.slice(touchpoint.mount.length) || "/" };
}

export function toShellPath(touchpoint: Touchpoint, appPath: string): string {
  if (!touchpoint.mount) return appPath;
  return appPath === "/" ? touchpoint.mount : touchpoint.mount + appPath;
}

export const frameBase = (touchpoint: Touchpoint) => `/touchpoint-apps/${touchpoint.slug}`;
