import { Clock } from "lucide-react";

/**
 * Consistent "Coming Soon" banner used to wrap unfinished tabs.
 * Use either as a standalone empty-state card (variant="card") or inline
 * pill (variant="pill") above tab content. Chrome matches the Sales
 * Order module's placeholder tabs so unfinished surfaces read the same
 * way across modules.
 */
export function ComingSoonBanner({
  title = "Coming Soon",
  message = "This area is being designed. Check back in a future release.",
  variant = "card",
}: {
  title?: string;
  message?: string;
  variant?: "card" | "pill";
}) {
  if (variant === "pill") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "#0F62D6",
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 999,
          lineHeight: 1,
        }}
      >
        Coming Soon
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        gap: 14,
        backgroundColor: "var(--card, #FFFFFF)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
      role="status"
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Clock style={{ width: 20, height: 20, color: "#0F62D6" }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{title}</div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "#0F62D6",
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 999,
          lineHeight: 1,
        }}
      >
        Coming Soon
      </span>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 380, lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}
