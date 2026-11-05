import { useState } from "react";
import { Archive } from "lucide-react";
import { ConfirmationModal } from "./ConfirmationModal";
import type { SalesOrder } from "./types";
import { formatMoney } from "@/app/currency/money";

/**
 * Archive Sales Order — Partner-style ConfirmationModal (red variant) with
 * a Reason textarea slotted into the body. Same surface as the bulk-archive
 * and Quote-side archive flows, so every destructive prompt in the SO module
 * reads identically.
 *
 * The elaborate reason-dropdown + sub-confirmation dialog the prior version
 * used has been collapsed into a single optional Reason field, matching the
 * design alignment with the Partner module.
 */

interface Props {
  so: SalesOrder;
  onConfirm: () => void;
  onClose: () => void;
}

export function ArchiveModal({ so, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");

  const activeLines = so.lines.filter(l => !l.cancelled);
  const totalValue = activeLines.reduce((sum, l) => sum + l.orderedQty * l.unitPrice, 0);

  return (
    <ConfirmationModal
      isOpen
      title="Archive Sales Order?"
      message={`This will move ${so.soNumber} (${formatMoney(totalValue, so.currency)}) to the archive. Archived orders are hidden from the default list but remain searchable under the Archived filter and can be unarchived at any time.`}
      confirmText="Archive Order"
      cancelText="Cancel"
      variant="red"
      icon={<Archive />}
      onCancel={onClose}
      onConfirm={() => { onConfirm(); }}
    >
      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
        Reason <span style={{ fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this order being archived? e.g., Order completed & fulfilled, customer inactive..."
        rows={3}
        style={{
          width: "100%", padding: "10px 12px", fontSize: 13, color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))", borderRadius: 8, outline: "none",
          backgroundColor: "var(--input-background, #fff)", resize: "vertical", minHeight: 72,
          boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
        This reason will be logged in activity for the archived order.
      </div>
    </ConfirmationModal>
  );
}
