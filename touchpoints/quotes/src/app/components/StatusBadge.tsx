import { QuoteStatus } from '@/app/types/quote';

interface StatusBadgeProps {
  status: QuoteStatus;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  'Draft':             { bg: 'rgba(100,116,139,0.14)', text: '#475569', label: 'Draft' },
  'Sent to Customer':  { bg: 'rgba(37,99,235,0.14)',   text: '#2563EB', label: 'Sent' },
  'Unconfirmed SO':    { bg: 'rgba(124,58,237,0.14)',   text: '#7C3AED', label: 'Confirmed by Customer' },
  'Confirmed SO':      { bg: 'rgba(22,163,74,0.14)',    text: '#16A34A', label: 'Converted to SO' },
  'Expired':           { bg: 'rgba(220,38,38,0.14)',    text: '#DC2626', label: 'Expired' },
  'Cancelled':         { bg: 'rgba(220,38,38,0.14)',    text: '#DC2626', label: 'Cancelled' },
  'Archived':          { bg: 'rgba(220,38,38,0.14)',    text: '#DC2626', label: 'Archived' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig['Draft'];

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        height: '22px', padding: '0 8px', borderRadius: '6px',
        fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
        backgroundColor: cfg.bg, color: cfg.text,
        lineHeight: '1',
      }}
    >
      {cfg.label}
    </span>
  );
}