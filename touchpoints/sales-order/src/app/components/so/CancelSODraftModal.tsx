/* CancelSODraftModal — short cancellation prompt for Draft sales orders.
   Mirrors the Quote-side CancelQuoteModal so the two modules read the
   same when cancelling a record that hasn't yet been cleared by ops.
   The full CancellationModal stays in place for any status past Draft
   where shipments, picks, or allocations need to be reasoned about. */

import { useState } from "react";
import { Ban } from "lucide-react";
import { ConfirmationModal } from "./ConfirmationModal";

interface CancelSODraftModalProps {
  isOpen: boolean;
  soNumber: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelSODraftModal({
  isOpen,
  soNumber,
  onCancel,
  onConfirm,
}: CancelSODraftModalProps) {
  const [reason, setReason] = useState("");

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Cancel Sales Order?"
      message={`This will cancel ${soNumber}. The order is still in Draft, so no inventory has been allocated and ops has not been notified. You can reactivate it later as a new draft, or duplicate it.`}
      confirmText="Cancel Sales Order"
      cancelText="Keep as-is"
      variant="red"
      icon={<Ban />}
      onCancel={() => { setReason(""); onCancel(); }}
      onConfirm={() => { onConfirm(reason.trim()); setReason(""); }}
    >
      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--foreground-soft)", marginBottom: 6 }}>
        Reason <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this sales order being cancelled? e.g., Customer withdrew, duplicate of another order, pricing no longer valid..."
        rows={3}
        style={{
          width: "100%", padding: "10px 12px", fontSize: 13, color: "var(--foreground)",
          border: "1px solid var(--border)", borderRadius: 8, outline: "none",
          backgroundColor: "var(--background)", resize: "vertical", minHeight: 72,
          boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
        This reason will be logged in activity and visible in the order history.
      </div>
    </ConfirmationModal>
  );
}
