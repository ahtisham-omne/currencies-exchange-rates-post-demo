import { QuoteStatus } from '@/app/types/quote';

/**
 * Quote status pill — Partner-aligned chrome.
 *
 * Reference: Partner's `VendorStatusBadge` (rounded-full pill, solid bg,
 * colored border, AAA-compliant text colors). Quote-specific statuses are
 * mapped onto Partner's three-tone palette plus blue/purple for active
 * lifecycle states.
 */
interface StatusBadgeProps {
  status: QuoteStatus;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Draft':            { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', label: 'Draft' },
  'Sent to Customer': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', label: 'Sent to Customer' },
  'Unconfirmed SO':   { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', label: 'Confirmed by Customer' },
  'Confirmed SO':     { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', label: 'Converted to SO' },
  'Expired':          { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', label: 'Expired' },
  'Rejected':         { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Rejected' },
  'Cancelled':        { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Cancelled' },
  'Archived':         { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Archived' },
};

/** The user-facing label for every quote state, in lifecycle order. The
 *  badge has always held these strings; exporting them lets other surfaces
 *  (the importer's status dropdown) offer the same list instead of repeating
 *  it. */
export const QUOTE_STATUS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(statusConfig).map(([status, cfg]) => [status, cfg.label]),
);

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig['Draft'];

  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: cfg.bg,
        color: cfg.text,
        borderColor: cfg.border,
      }}
    >
      {cfg.label}
    </span>
  );
}
