import { useState } from 'react';
import { Calendar, GitBranch, AlertCircle } from 'lucide-react';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';

interface ReviveCancelledModalProps {
  quoteNumber: string;
  customerName: string;
  currentVersion: number;
  /** The status the quote was in before it was cancelled */
  statusBeforeCancellation: 'draft' | 'sent' | 'confirmed' | 'converted' | 'expired' | null;
  cancellationReason?: string | null;
  onConfirm: (newExpiryDate: string) => void;
  onClose: () => void;
}

/**
 * Revive a cancelled quote — wraps `ConfirmDiscardModal` (primary variant)
 * with a single date input + a context note about whether reviving will
 * bump the version.
 */
export function ReviveCancelledModal({
  quoteNumber,
  customerName,
  currentVersion,
  statusBeforeCancellation,
  cancellationReason,
  onConfirm,
  onClose,
}: ReviveCancelledModalProps) {
  const today = new Date('2026-02-23');
  const defaultExpiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const toInputDate = (d: Date) => d.toISOString().split('T')[0];
  const [newExpiryDate, setNewExpiryDate] = useState(toInputDate(defaultExpiry));

  const isValid = !!newExpiryDate && new Date(newExpiryDate) > today;

  const willBumpVersion = statusBeforeCancellation !== 'draft';
  const newVersion = willBumpVersion ? currentVersion + 1 : currentVersion;

  return (
    <ConfirmDiscardModal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      variant="primary"
      badge="Revive"
      title="Revive cancelled quote?"
      description={`Re-open ${quoteNumber} for ${customerName}. Set a new expiry date below — the quote will be reactivated as ${willBumpVersion ? `V${newVersion} (bumped from V${currentVersion})` : `V${currentVersion}`}.`}
      confirmLabel={`Revive as V${newVersion}`}
      cancelLabel="Cancel"
      onConfirm={() => { if (isValid) onConfirm(newExpiryDate); }}
    >
      <div className="space-y-3">
        {cancellationReason && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#B45309' }} />
            <div className="text-[12px]" style={{ color: '#92400E', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>Cancelled because:</span> {cancellationReason}
            </div>
          </div>
        )}

        <div>
          <label
            className="block text-[11px] text-muted-foreground mb-1.5"
            style={{ fontWeight: 500 }}
          >
            New expiry date
          </label>
          <div className="relative">
            <Calendar
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
            />
            <input
              type="date"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              min={toInputDate(new Date(today.getTime() + 24 * 60 * 60 * 1000))}
              className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg border border-border bg-white text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              style={{ fontWeight: 500 }}
            />
          </div>
          {!isValid && newExpiryDate && (
            <p className="text-[11px] text-destructive mt-1.5" style={{ fontWeight: 500 }}>
              Expiry must be in the future.
            </p>
          )}
        </div>

        {willBumpVersion && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent" style={{ border: '1px solid rgba(10,119,255,0.18)' }}>
            <GitBranch className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[11px] text-primary" style={{ fontWeight: 500 }}>
              Last status was {statusBeforeCancellation}. Reviving creates a new draft version (V{newVersion}).
            </span>
          </div>
        )}
      </div>
    </ConfirmDiscardModal>
  );
}
