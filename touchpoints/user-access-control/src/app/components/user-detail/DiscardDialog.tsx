import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";

interface DiscardDialogProps {
  changeCount?: number;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/** Discard-changes confirmation, wraps the shared DestructiveConfirmModal. */
export function DiscardDialog({
  changeCount,
  title = "Discard changes?",
  description,
  confirmLabel = "Discard changes",
  cancelLabel = "Continue editing",
  onKeepEditing,
  onDiscard,
}: DiscardDialogProps) {
  const resolvedDescription =
    description ||
    (changeCount != null
      ? `You have ${changeCount} unsaved change${changeCount !== 1 ? "s" : ""}. All unsaved changes will be lost. This action cannot be undone.`
      : "All information entered in this form will be lost. This action cannot be undone.");

  return (
    <DestructiveConfirmModal
      open={true}
      onClose={onKeepEditing}
      badge="Discard"
      title={title}
      description={resolvedDescription}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onDiscard}
    />
  );
}
