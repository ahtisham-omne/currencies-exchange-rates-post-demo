// CancelQuoteModal — canonical "cancel a quote with reason" prompt.
// Extracted from the ReasonModal pattern previously embedded inside
// StatusActionButton so the kanban drag-drop, listing three-dot menu
// and details-page Actions menu all use the same modal.

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';

interface CancelQuoteModalProps {
  isOpen: boolean;
  quoteNumber: string;
  /** When the quote is in Confirmed SO, the body gets a stronger warning
   *  about the SO not being cancelled by this action. */
  fromConfirmedSO?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelQuoteModal({
  isOpen,
  quoteNumber,
  fromConfirmedSO = false,
  onCancel,
  onConfirm,
}: CancelQuoteModalProps) {
  const [reason, setReason] = useState('');

  const body = fromConfirmedSO
    ? `This will cancel ${quoteNumber}. Only proceed if there's no active Sales Order on it — cancelling the quote does not cancel the SO.`
    : `This will cancel ${quoteNumber} and notify all associated parties. You can reactivate it later as a new draft version, or duplicate it.`;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Cancel Quote?"
      message={body}
      confirmText="Cancel Quote"
      cancelText="Keep as-is"
      variant="red"
      icon={<Ban />}
      onCancel={() => { setReason(''); onCancel(); }}
      onConfirm={() => { onConfirm(reason.trim()); setReason(''); }}
    >
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginBottom: 6 }}>
        Reason <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this quote being cancelled? e.g., Customer withdrew interest, pricing no longer valid..."
        rows={3}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--foreground)',
          border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
          backgroundColor: 'var(--background)', resize: 'vertical', minHeight: 72,
          boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
        This reason will be logged in activity and visible in version history.
      </div>
    </ConfirmationModal>
  );
}
