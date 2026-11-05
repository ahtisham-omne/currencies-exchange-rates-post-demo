import { Sparkles } from "lucide-react";

/**
 * Consistent "Coming Soon" banner used to wrap unfinished tabs.
 * Use either as a standalone empty-state card (variant="card") or inline
 * pill (variant="pill") above tab content.
 */
export function ComingSoonBanner({
  title = "Coming soon",
  message = "This area is being designed. Check back in a future release.",
  variant = "card",
}: {
  title?: string;
  message?: string;
  variant?: "card" | "pill";
}) {
  if (variant === "pill") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 500,
          color: "#0F62D6",
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 999,
          lineHeight: 1,
        }}
      >
        <Sparkles style={{ width: 12, height: 12 }} />
        Coming soon
      </div>
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
        padding: "56px 24px",
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
          borderRadius: "50%",
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles style={{ width: 20, height: 20, color: "#0F62D6" }} />
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 500,
          color: "#0F62D6",
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 999,
          lineHeight: 1,
        }}
      >
        Coming soon
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 380, lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}
