/**
 * Archiving a return, asked before it happens.
 *
 * Archive used to act on the click: the return left the list with a toast,
 * and nothing said where it had gone. Only a cancelled return can be archived,
 * so nothing is lost, but a return that vanishes from the default list reads
 * as deleted. The dialog says what is being put away and where to find it.
 */

import { Archive } from 'lucide-react';

import RMAConfirmModal from '@/app/components/rma/RMAConfirmModal';
import type { RMA } from '@/app/data/mockRMAs';
import { authorizedQty } from '@/app/data/mockRMAs';

export function RMAArchiveModal({
  rma,
  open,
  onOpenChange,
  onConfirm,
}: {
  rma: RMA | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!rma) return null;
  const units = rma.items.reduce((n, li) => n + authorizedQty(li), 0);
  const lines = rma.items.length;

  return (
    <RMAConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      tone="neutral"
      icon={Archive}
      eyebrow="Archive"
      title={`Archive ${rma.rmaNumber}?`}
      description={
        <>
          <span
            className="mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left"
            style={{ backgroundColor: '#FAFAF9', border: '1px solid #E7E5E4' }}
          >
            <span className="min-w-0">
              <span
                className="block truncate"
                style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}
              >
                {rma.vendor}
              </span>
              <span className="block" style={{ fontSize: 11, color: '#78716C' }}>
                {lines} {lines === 1 ? 'line' : 'lines'} · {units} {units === 1 ? 'unit' : 'units'}
              </span>
            </span>
            <span
              className="shrink-0 rounded-full"
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#B91C1C',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              Cancelled
            </span>
          </span>
          This return will be moved out of the Returns list. It stays on record and
          read-only, and you can find it with the Archived status filter.
        </>
      }
      confirmLabel="Archive RMA"
      cancelLabel="Keep in list"
      onConfirm={onConfirm}
    />
  );
}
