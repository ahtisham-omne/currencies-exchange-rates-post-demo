/**
 * AcquisitionPills — renders acquisition method(s) for an item.
 *
 * Rules:
 *   - 0 methods → em-dash placeholder
 *   - 1 method  → one filled pill
 *   - 2 methods → two pills side-by-side; primary filled, secondary outline.
 *                  A tiny PRIMARY micro-label sits above the primary pill.
 *
 * Color tokens (Partners-aligned):
 *   Purchase      → blue   #EFF6FF / #1E40AF / #DBEAFE
 *   Manufacturing → amber  #FFFBEB / #92400E / #FDE68A
 */

export type AcquisitionMethod = "Purchase" | "Manufacturing";

const COLORS: Record<AcquisitionMethod, { bg: string; text: string; border: string }> = {
  Purchase: { bg: "#EFF6FF", text: "#1E40AF", border: "#DBEAFE" },
  Manufacturing: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};

/**
 * Canonical display labels. The underlying data keys stay "Purchase"/"Manufacturing"
 * (shared by 15+ consumers), but every pill renders the past-participle form so the
 * listing columns match the Acquisition filter ("Purchased" / "Manufactured").
 */
const LABELS: Record<AcquisitionMethod, string> = {
  Purchase: "Purchased",
  Manufacturing: "Manufactured",
};

function Pill({ method, variant }: { method: AcquisitionMethod; variant: "filled" | "outline" }) {
  const c = COLORS[method];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: variant === "filled" ? c.bg : "transparent",
        color: c.text,
        borderColor: c.border,
      }}
    >
      {LABELS[method] ?? method}
    </span>
  );
}

export function AcquisitionPill({
  method,
  variant = "filled",
}: {
  method: AcquisitionMethod;
  variant?: "filled" | "outline";
}) {
  return <Pill method={method} variant={variant} />;
}

/** Renders all acquisition methods as filled chips, side-by-side. No PRIMARY label. */
export function AcquisitionMethodsList({ methods }: { methods: AcquisitionMethod[] }) {
  if (!methods || methods.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1.5 min-w-0 flex-wrap">
      {methods.map((m) => (
        <Pill key={m} method={m} variant="filled" />
      ))}
    </div>
  );
}

/** Renders the single preferred (primary) acquisition method, or em-dash. */
export function PreferredAcquisition({ primary }: { primary: AcquisitionMethod | null }) {
  if (!primary) return <span className="text-sm text-muted-foreground">—</span>;
  return <Pill method={primary} variant="filled" />;
}

export interface AcquisitionPillsProps {
  methods: AcquisitionMethod[];
  primary: AcquisitionMethod | null;
}

export function AcquisitionPills({ methods, primary }: AcquisitionPillsProps) {
  if (!methods || methods.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (methods.length === 1) {
    return <Pill method={methods[0]} variant="filled" />;
  }

  // 2 methods — primary filled with PRIMARY micro-label above, secondary outline
  const primaryMethod = (primary && methods.includes(primary) ? primary : methods[0]) as AcquisitionMethod;
  const secondaryMethod = methods.find((m) => m !== primaryMethod) as AcquisitionMethod | undefined;

  return (
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <div className="flex flex-col items-start leading-none">
        <span
          className="text-[8px] uppercase tracking-wider text-primary mb-0.5"
          style={{ fontWeight: 700 }}
        >
          Primary
        </span>
        <Pill method={primaryMethod} variant="filled" />
      </div>
      {secondaryMethod && <Pill method={secondaryMethod} variant="outline" />}
    </div>
  );
}