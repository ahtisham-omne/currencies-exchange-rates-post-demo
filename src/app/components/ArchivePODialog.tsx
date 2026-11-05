import React from "react";
import { Archive } from "lucide-react";
import { ARCHIVE_CANCELS_STATUSES } from "./poStore";
import { CancelReasonFields, useCancelReason } from "./CancelReasonFields";
import { POActionDialog } from "./POActionDialog";

/* Archive PO confirmation (ERP-4744 AC 10-11, ERP-4772 AC 5). Shared by
   the PO listing row menu and the PO detail Actions menu. Glow-header
   chrome via POActionDialog. Sent / Confirmed POs are also cancelled on
   archive, so they ask for the same reason dropdown + notes Cancel PO
   uses. Archive is never disabled — a missing reason shows on click. */
export function ArchivePODialog({
  open,
  onOpenChange,
  poNumber,
  status,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poNumber: string;
  status: string;
  onConfirm: (reason?: string, notes?: string) => void;
}) {
  const reasonState = useCancelReason(open);
  const alsoCancels = ARCHIVE_CANCELS_STATUSES.has(status);

  return (
    <POActionDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="red"
      icon={Archive}
      chipLabel="Archive PO"
      title={`Archive PO ${poNumber}?`}
      description={alsoCancels
        ? "This also cancels it and notifies the vendor. You can restore it later."
        : "This will move it out of your active list. You can restore it later."}
      primaryLabel="Archive"
      secondaryLabel="Cancel"
      onPrimary={() => {
        if (!alsoCancels) {
          onConfirm();
          onOpenChange(false);
          return;
        }
        const result = reasonState.validate();
        if (!result) return;
        onConfirm(result.reason, result.notes);
        onOpenChange(false);
      }}
    >
      {alsoCancels && <CancelReasonFields state={reasonState} />}
    </POActionDialog>
  );
}
