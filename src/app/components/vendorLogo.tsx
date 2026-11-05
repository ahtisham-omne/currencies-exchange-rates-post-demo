/* ═══════════════════════════════════════════════════════════════
   VENDOR LOGO — shared resolver + chip

   Single source of truth for rendering a vendor's brand logo across the
   planner (the Qualified-vendors cards and the Gap Graph allocation
   tooltip). Resolves the vendor name → a brand domain → the real favicon;
   falls back to an initials monogram on a stable tint when the domain is
   unknown or the image fails to load.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";

/* Deterministic monogram palette for the initials fallback — each vendor
   gets a stable tinted chip keyed off its id/name. */
const AVATAR_TONES: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#EEF2FF", fg: "#4338CA" },
  { bg: "#ECFDF5", fg: "#047857" },
  { bg: "#FFF7ED", fg: "#C2410C" },
  { bg: "#EFF6FF", fg: "#1D4ED8" },
  { bg: "#FDF2F8", fg: "#BE185D" },
  { bg: "#F5F3FF", fg: "#6D28D9" },
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#FEFCE8", fg: "#A16207" },
];

function vendorInitials(name: string): string {
  const tokens = name
    .replace(/[^A-Za-z0-9 -]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

/* Brand-domain lookup. Keyed by a keyword found in the vendor name
   (most-specific first) → the brand's domain. Vendors with no match fall
   back to initials. */
const VENDOR_DOMAINS: ReadonlyArray<readonly [string, string]> = [
  ["bosch rexroth", "boschrexroth.com"],
  ["bosch", "bosch.com"],
  ["parker", "parker.com"],
  ["brembo", "brembo.com"],
  ["akebono", "akebono-brake.com"],
  ["sachs", "zf.com"],
  ["mann", "mann-hummel.com"],
  ["donaldson", "donaldson.com"],
  ["denso", "denso.com"],
  ["gkn", "gknautomotive.com"],
  ["nexteer", "nexteer.com"],
  ["skf", "skf.com"],
  ["ntn", "ntnglobal.com"],
  ["federal-mogul", "tenneco.com"],
  ["bossard", "bossard.com"],
  ["te connectivity", "te.com"],
  ["molex", "molex.com"],
  ["chrysler", "stellantis.com"],
  ["stellantis", "stellantis.com"],
  ["lucid", "lucidmotors.com"],
  ["rivian", "rivian.com"],
  ["toyota", "toyota.com"],
  ["nissan", "nissanusa.com"],
  ["ford", "ford.com"],
  ["bmw", "bmw.com"],
  ["general motors", "gm.com"],
  ["tesla", "tesla.com"],
  ["honda", "honda.com"],
  ["misumi", "misumi.com"],
  ["apple", "apple.com"],
  ["figma", "figma.com"],
  ["honeywell", "honeywell.com"],
  ["3m", "3m.com"],
  ["cdw", "cdw.com"],
  ["grainger", "grainger.com"],
  ["mcmaster", "mcmaster.com"],
  ["fastenal", "fastenal.com"],
  ["motion", "motionindustries.com"],
  ["applied", "applied.com"],
];

function vendorDomain(name: string): string | null {
  const n = name.toLowerCase();
  for (const [kw, domain] of VENDOR_DOMAINS) if (n.includes(kw)) return domain;
  return null;
}

/** Brand-logo URL for a vendor name, or null when the domain is unknown. */
function vendorLogoUrl(name: string): string | null {
  const d = vendorDomain(name);
  return d ? `https://icons.duckduckgo.com/ip3/${d}.ico` : null;
}

/** Vendor logo chip — the brand's real logo when we can resolve its domain,
    otherwise an initials monogram on a stable tint. Falls back to initials if
    the logo image fails to load. `size` is the square px edge (default 36 —
    the vendor-card avatar); pass a smaller size (e.g. 18) for the gap-graph
    tooltip. */
export function VendorLogo({
  name,
  id,
  size = 36,
  radius = "rounded-lg",
}: {
  name: string;
  id?: string;
  size?: number;
  radius?: string;
}) {
  const url = vendorLogoUrl(name);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    const inner = Math.round(size * 0.78);
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white ${radius}`}
        style={{ width: size, height: size }}
      >
        <img
          src={url}
          alt={`${name} logo`}
          className="object-contain"
          style={{ width: inner, height: inner }}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  const seed = (id ?? name).split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const tone = AVATAR_TONES[seed % AVATAR_TONES.length];
  return (
    <span
      className={`grid shrink-0 place-items-center font-bold ${radius}`}
      style={{
        width: size,
        height: size,
        backgroundColor: tone.bg,
        color: tone.fg,
        fontSize: Math.max(8, Math.round(size * 0.34)),
      }}
      aria-hidden
    >
      {vendorInitials(name)}
    </span>
  );
}
