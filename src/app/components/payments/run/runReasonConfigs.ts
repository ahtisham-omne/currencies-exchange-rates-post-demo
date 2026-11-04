import type { ReasonActionConfig } from '@/app/components/InvoiceReasonDialog';

/* ── Run flavors of the reason dialog (8/4/26) ───────────────────────
 * The payment run lifecycle reuses the invoice module's reason dialog
 * AS IS (InvoiceReasonDialog + these overrides): same gradient hero,
 * reason select, description, notify recipients, and supporting
 * documents — only the copy and the reason lists are run-specific.
 * Cancel additionally gains the notify block the invoice flavor
 * doesn't carry (user request 8/4/26). */

export const RUN_HOLD_OVERRIDE: Partial<ReasonActionConfig> = {
  targetLabel: 'Run Hold',
  title: 'Place this run on hold?',
  description:
    'The run keeps its place and its invoice locks, but approve and execute stay locked until the hold is released. The reason you mention here will be recorded.',
  actionText: 'Place Run on Hold',
  reasons: [
    'Awaiting Funding Confirmation',
    'Vendor Dispute in Progress',
    'Waiting on Missing Documents',
    'Cash Flow Timing',
    'Other',
  ],
};

export const RUN_CANCEL_OVERRIDE: Partial<ReasonActionConfig> = {
  title: 'Cancel this payment run?',
  description:
    'Nothing has posted. The invoices return to the payable pool, free for any future run. A cancelled run cannot be reopened.',
  actionText: 'Cancel Payment Run',
  reasons: [
    'Created in Error',
    'Duplicate Run',
    'Wrong Payment Date',
    'Funding Not Available',
    'Other',
  ],
  // The invoice cancel has no notify block; the run cancel does
  // (feedback 8/4/26), in the modal's destructive tone.
  notify: {
    label: 'Notify on Cancellation',
    accentColor: 'hsl(var(--destructive))',
    accentBg: '#FEF2F2',
    accentBorder: '#FECACA',
    accentText: '#B91C1C',
  },
};

/* ── Request changes (8/5/26, replaces blunt rejection) ──────────────
 * The approver never rejects a run outright: they flag ISSUES, per line
 * or on the whole run, and the request routes back to the creator as
 * fixes to make. Reason lists below feed RunRequestChangesModal. */

/** Per-line change reasons: what needs fixing on one invoice. */
export const RUN_LINE_CHANGE_REASONS = [
  'Wrong Payment Method',
  'Wrong Pay-From Account',
  'Amount Needs Review',
  'Pay a Partial Amount',
  'Duplicate Payment Risk',
  'Pay on a Later Run',
  'Other',
];

/** Run-level change reasons: what needs fixing on the whole proposal. */
export const RUN_CHANGE_REASONS = [
  'Wrong Invoices Selected',
  'Payment Date Needs to Move',
  'Amounts Need Review',
  'Split Across Pay-From Accounts',
  'Not the Right Time to Pay',
  'Other',
];
