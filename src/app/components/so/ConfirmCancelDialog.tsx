import { useMemo } from "react";
import { Ban } from "lucide-react";
import { ConfirmationDialog } from "./ui/DiscardChangesDialog";
import type { SalesOrder } from "./types";

interface Props {
  so: SalesOrder;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmCancelDialog({ so, onConfirm, onClose }: Props) {
  const activeLines = so.lines.filter(l => !l.cancelled);
  const totalAllocated = activeLines.reduce((s, l) => s + l.allocatedQty, 0);
  const totalShipped = activeLines.filter(l => l.shippedQty > 0).reduce((s, l) => s + l.shippedQty, 0);

  const descLines = useMemo(() => {
    const lines: string[] = [];
    lines.push(`${activeLines.length} active line item${activeLines.length !== 1 ? "s" : ""} will be cancelled.`);
    if (totalAllocated > 0) lines.push(`${totalAllocated} allocated unit${totalAllocated !== 1 ? "s" : ""} will be released.`);
    if (totalShipped > 0) lines.push(`${totalShipped} shipped unit${totalShipped !== 1 ? "s" : ""} will remain shipped.`);
    lines.push("This action cannot be easily undone.");
    return lines;
  }, [activeLines.length, totalAllocated, totalShipped]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ConfirmationDialog
      open={true}
      icon={<Ban style={{ width: 28, height: 28, color: "var(--destructive)" }} />}
      badge="CANCEL"
      title="Cancel this sales order?"
      description={descLines}
      confirmLabel="Cancel order"
      dismissLabel="Keep order"
      onConfirm={handleConfirm}
      onDismiss={onClose}
    />
  );
}
