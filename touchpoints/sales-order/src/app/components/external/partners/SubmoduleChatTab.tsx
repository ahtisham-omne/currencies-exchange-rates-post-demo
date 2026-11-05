// Shim — minimal placeholder for Partner Management's SubmoduleChatTab.
// The full chat surface lives in Partner Management; in Quote/SO we only
// need a non-crashing component so the detail modals (PaymentTerm,
// PricingRule) keep mounting. Safe to delete when the canonical chat
// component is portable.
import { toast } from "sonner";

export function SubmoduleChatTab(_props: Record<string, unknown> = {}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ padding: 32, gap: 8, color: "var(--muted-foreground)", fontSize: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Chat</div>
      <div>Chat is configured in the Partner Management module.</div>
      <button
        type="button"
        onClick={() =>
          toast.info("Chat is configured in the Partner Management module.", {
            description: "A starter default has been applied.",
          })
        }
        className="rounded-md border border-border bg-white hover:bg-slate-50 transition-colors"
        style={{ height: 28, padding: "0 10px", fontSize: 11, fontWeight: 500 }}
      >
        Open in Partner Management
      </button>
    </div>
  );
}
