/*
 * Transactions table status chip — 2-segment outlined idiom.
 *
 * Structure (identical for every status, regardless of length):
 *   ┌──────────────┬───────────────┐
 *   │  Primary     │  Qualifier    │
 *   └──────────────┴───────────────┘
 *   - Primary segment: tinted bg, tone-colored text, whitespace-nowrap (title case).
 *   - Qualifier segment: neutral bg, muted text, whitespace-nowrap, separated by border-l.
 *   - When no qualifier present, the right segment is omitted (single rounded pill).
 *
 * Primary text uses TITLE CASE to match Items listing's Status column convention
 * ("On Hand", "Quarantine", "Out of Stock").
 *
 * Palette (Items-domain, AAA-ish contrast):
 *   On Hand     — emerald  bg #ECFDF5  text #047857  border #A7F3D0
 *   Quarantine  — amber    bg #FFFBEB  text #92400E  border #FDE68A
 *   Out of Stock — rose    bg #FEF2F2  text #991B1B  border #FECACA
 */

type Tone = "emerald" | "amber" | "rose" | "slate";

const TONE: Record<Tone, { bg: string; text: string; border: string }> = {
  emerald: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  amber:   { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  rose:    { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  slate:   { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
};

/**
 * Splits the raw status string into a normalized primary phrase + optional qualifier.
 * Primary is forced to canonical title-case form so the chip surface looks identical
 * regardless of source casing ("On-Hand" / "on hand" / "OUT OF STOCK" → normalized).
 */
function parseStatus(status: string): { primary: string; qualifier: string; tone: Tone } {
  const trimmed = status.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("on-hand") || lower.startsWith("on hand")) {
    const rest = trimmed.replace(/^on[-\s]hand\s*/i, "").trim();
    return { primary: "On Hand", qualifier: rest, tone: "emerald" };
  }
  if (lower.startsWith("quarantine")) {
    const rest = trimmed.replace(/^quarantine\s*/i, "").trim();
    return { primary: "Quarantine", qualifier: rest, tone: "amber" };
  }
  if (lower.startsWith("out of stock") || lower.startsWith("out-of-stock")) {
    const rest = trimmed.replace(/^out[-\s]of[-\s]stock\s*/i, "").trim();
    return { primary: "Out of Stock", qualifier: rest, tone: "rose" };
  }

  // Unknown status: keep first token as primary, remainder as qualifier.
  const parts = trimmed.split(/\s+/);
  return { primary: parts[0] ?? trimmed, qualifier: parts.slice(1).join(" "), tone: "slate" };
}

interface TransactionStatusBadgeProps {
  status: string;
}

export function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const { primary, qualifier, tone } = parseStatus(status);
  const t = TONE[tone];
  return (
    <span
      className="inline-flex items-stretch h-5 rounded-md border overflow-hidden align-middle whitespace-nowrap shrink-0"
      style={{ borderColor: t.border }}
    >
      <span
        className="inline-flex items-center px-1.5 text-[11px] whitespace-nowrap"
        style={{
          backgroundColor: t.bg,
          color: t.text,
          fontWeight: 600,
        }}
      >
        {primary}
      </span>
      {qualifier && (
        <span
          className="inline-flex items-center px-1.5 text-[11px] bg-white text-muted-foreground whitespace-nowrap"
          style={{
            borderLeft: `1px solid ${t.border}`,
            fontWeight: 500,
          }}
        >
          {qualifier}
        </span>
      )}
    </span>
  );
}