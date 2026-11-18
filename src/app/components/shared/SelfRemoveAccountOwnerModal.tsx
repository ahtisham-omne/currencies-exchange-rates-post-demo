import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { DestructiveConfirmModal } from "./DestructiveConfirmModal";
import { ACCOUNT_OWNER_COPY, getAccountOwnerRules } from "../../data/account-owner";

/**
 * The warning an Account Owner sees before removing the role from themselves
 * (ERP-7648 AC6, ERP-5164 AC9, ERP-5510 AC15). It stands in for the generic
 * remove flows on the profile and on the role's Users tab.
 *
 * The rule is checked again at the moment of removal, so two owners can't both
 * remove themselves at once and leave the role with no holder: if the other
 * owner has gone in the meantime, the removal is refused with the reason.
 */
export function SelfRemoveAccountOwnerModal({
  open,
  onClose,
  userId,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** The owner removing themselves. */
  userId: number;
  /** Takes the role off; runs only while another holder remains. */
  onConfirm: () => void;
}) {
  return (
    <DestructiveConfirmModal
      open={open}
      onClose={onClose}
      badge="ACCOUNT OWNER"
      tone="danger"
      icon={ShieldOff}
      title={ACCOUNT_OWNER_COPY.selfRemoveTitle}
      description={ACCOUNT_OWNER_COPY.selfRemoveBody}
      confirmLabel={ACCOUNT_OWNER_COPY.selfRemoveConfirm}
      cancelLabel="Cancel"
      onConfirm={() => {
        const { removeOwnerRole } = getAccountOwnerRules(userId, userId);
        if (removeOwnerRole.allowed) {
          onConfirm();
        } else {
          toast.error(removeOwnerRole.reason);
        }
        onClose();
      }}
    />
  );
}
