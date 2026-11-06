// Shim — minimal placeholder for Partner Management's PartnerItemsTab.
// The PricingRule detail modal mounts this when viewing items linked to
// the rule. Quote/SO doesn't need the full items catalogue, so we just
// render a notice card. Safe to delete when the canonical component is
// portable.
import type { Vendor } from "./vendors-data";

interface PartnerItemsTabProps {
  vendor: Vendor;
  hideHeader?: boolean;
  compact?: boolean;
  contextLabel?: string;
  contextType?: "discount" | "premium";
  compactToolbar?: boolean;
  flush?: boolean;
  lockSubTab?: "sell" | "purchase";
  locationView?: boolean;
}

export function PartnerItemsTab(_props: PartnerItemsTabProps) {
  return (
    <div
      className="flex flex-col"
      style={{ padding: 16, gap: 8, color: "var(--muted-foreground)", fontSize: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Items</div>
      <div>The partner items catalogue is configured in the Partner Management module.</div>
    </div>
  );
}
