// ArchiveQuoteModal — canonical "archive a quote with reason" prompt.
// Mirrors the Bulk Archive modal pattern so single-quote archive
// (listing three-dot menu, kanban, details-page Actions menu) reads
// identically.

import { useState } from 'react';
import { Archive } from 'lucide-react';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';

interface ArchiveQuoteModalProps {
  isOpen: boolean;
  quoteNumber: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ArchiveQuoteModal({
  isOpen,
  quoteNumber,
  onCancel,
  onConfirm,
}: ArchiveQuoteModalProps) {
  const [reason, setReason] = useState('');

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Archive Quote?"
      message={`${quoteNumber} will be moved to the archive. Archived quotes are hidden from active views but can be restored later.`}
      confirmText="Archive"
      cancelText="Keep as-is"
      variant="red"
      icon={<Archive />}
      onCancel={() => { setReason(''); onCancel(); }}
      onConfirm={() => { onConfirm(reason.trim()); setReason(''); }}
    >
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginBottom: 6 }}>
        Reason <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this quote being archived? e.g., Stale, superseded by newer version..."
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
