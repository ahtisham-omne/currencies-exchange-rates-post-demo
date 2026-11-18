import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import RMAConfirmModal from '@/app/components/rma/RMAConfirmModal';
import type { RMA } from '@/app/data/mockRMAs';
import { useRMAContext } from '@/app/rma-context';

/**
 * Post-Draft edit gate, ported from the Purchase Order module's `guardEdit`
 * in `PurchaseOrderDraft.tsx`. Once a return has left Draft the first edit is
 * held back behind a confirmation so the user knows the change is recorded as
 * a version rather than applied quietly. Confirming opens the PO's editing
 * session: every edit after it applies without a version, and Save Version
 * records them all as one (ERP-11107). The prompt fires once per session.
 */
/** `minor` edits (DQ-07: owner, contact, notes, tags, carrier, shipping
 *  instruction, the vendor's RMA number) save in place without a version, so
 *  they pass straight through. Everything else is treated as material. */
export type RMAEditKind = 'material' | 'minor';
type GuardEdit = (action: () => void, kind?: RMAEditKind) => void;
const EditGateContext = createContext<GuardEdit>((action) => action());

export function useRMAEditGate() {
  return useContext(EditGateContext);
}

export function RMAEditGateProvider({
  rma,
  children,
}: {
  rma: RMA | null | undefined;
  children: React.ReactNode;
}) {
  const { editSessionActive, startEditSession } = useRMAContext();
  const [pending, setPending] = useState<{ action: () => void } | null>(null);

  const rmaId = rma?.id;
  useEffect(() => {
    setPending(null);
  }, [rmaId]);
  const confirmed = !!rmaId && editSessionActive(rmaId);

  const isDraft = rma?.status === 'Draft';

  const guardEdit = useCallback(
    (action: () => void, kind: RMAEditKind = 'material') => {
      if (!rma || isDraft || confirmed || kind === 'minor') {
        action();
        return;
      }
      setPending({ action });
    },
    [rma, isDraft, confirmed],
  );

  const value = useMemo(() => guardEdit, [guardEdit]);

  const nextVersion = (rma?.currentVersion ?? rma?.versions?.[0]?.version ?? 1) + 1;

  return (
    <EditGateContext.Provider value={value}>
      {children}
      <RMAConfirmModal
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        tone="warning"
        icon={AlertTriangle}
        eyebrow={`Create V${nextVersion}`}
        title="This will create a new version"
        description={
          <>
            {rma?.rmaNumber} is currently in
            <Badge variant="outline" className="mx-1 text-[10px] px-1.5 py-0 align-middle">
              {rma?.status}
            </Badge>
            state. The changes you make are saved together as Version {nextVersion} when you
            press Save Version, and it stays {rma?.status}. You can discard them before then.
            A return that has started shipping can only have unshipped lines reduced or
            cancelled.
          </>
        }
        confirmLabel="Continue editing"
        cancelLabel="Cancel"
        onConfirm={() => {
          const action = pending?.action;
          if (rmaId) startEditSession(rmaId);
          setPending(null);
          action?.();
        }}
      />
    </EditGateContext.Provider>
  );
}
