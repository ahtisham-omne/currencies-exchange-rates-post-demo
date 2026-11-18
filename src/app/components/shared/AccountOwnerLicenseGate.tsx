import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { DestructiveConfirmModal } from "./DestructiveConfirmModal";
import { ACCOUNT_OWNER_COPY, useAccountOwnerRules } from "../../data/account-owner";

/**
 * The step an Account Owner passes before lowering or removing their own
 * license. They keep the role, but it doesn't take effect until they hold Full
 * Access again (ERP-5184 and ERP-5186 AC8), so this says so up front, then
 * hands over to the normal license flow. The only holder passes it too.
 *
 *   const { owner, guard, gateModal } = useAccountOwnerLicenseGate(userId);
 *   onSelect={() => guard(() => setDowngradeOpen(true))}
 */
export function useAccountOwnerLicenseGate(userId: number | undefined) {
  const owner = useAccountOwnerRules(userId ?? -1);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const guard = (next: () => void) => {
    if (owner.isOwner && owner.isSelf && owner.lowerLicense.allowed) {
      setPending(() => next);
    } else {
      next();
    }
  };

  const gateModal = (
    <DestructiveConfirmModal
      open={pending != null}
      onClose={() => setPending(null)}
      badge="ACCOUNT OWNER"
      tone="warning"
      icon={ShieldCheck}
      title={ACCOUNT_OWNER_COPY.selfLicenseTitle}
      description={ACCOUNT_OWNER_COPY.selfLicenseBody}
      confirmLabel="Continue"
      cancelLabel="Cancel"
      onConfirm={() => {
        const next = pending;
        setPending(null);
        next?.();
      }}
    />
  );

  return { owner, guard, gateModal };
}
