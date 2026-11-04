import { ArrowLeftRight, Ban } from 'lucide-react';
import type { ReasonActionConfig } from '@/app/components/InvoiceReasonDialog';

/* ── Void payment (user 10/22/26) ────────────────────────────────────
 * Voiding a payment confirms with the invoice CANCEL dialog AS IS
 * (InvoiceReasonDialog action="cancel" + this override): the same red
 * hero, reason select, description ∥ supporting documents and notify
 * card — only the copy and the reason list are payment-specific. */
export const PAYMENT_VOID_OVERRIDE: Partial<ReasonActionConfig> = {
  targetLabel: 'Void',
  title: 'Void this payment?',
  description: "The GL reverses and any invoice balances reopen. A voided payment can't be reopened.",
  actionText: 'Void Payment',
  countNoun: 'payment',
  reasons: [
    'Created in Error',
    'Duplicate Payment',
    'Wrong Vendor or Amount',
    'Payment Was Never Sent',
    'Other',
  ],
  icon: Ban,
  notify: {
    label: 'Notify People',
    helper: "They'll be told this payment was voided.",
    accentColor: 'hsl(var(--destructive))',
    accentBg: '#FEF2F2',
    accentBorder: '#FECACA',
    accentText: '#B91C1C',
  },
  descriptionPlaceholder: 'Why is this payment being voided?',
  secondaryText: 'Keep Payment',
  listHrefBase: '/payments-v2/',
};

/** What voiding does to the books (user 10/22/26): a Scheduled payment
 *  never posted, so it has no GL reversal and settled nothing; only a
 *  posted payment reverses. Shared by the void dialog and its toasts. */
export function voidEffectText(payments: { status: string }[]): string {
  const scheduled = payments.filter((p) => p.status === 'Scheduled').length;
  const posted = payments.length - scheduled;
  if (payments.length > 0 && posted === 0) {
    return payments.length === 1
      ? 'This payment was only scheduled, so nothing has posted and there is no GL reversal.'
      : 'These payments were only scheduled, so nothing has posted and there is no GL reversal.';
  }
  if (scheduled > 0) {
    return `The GL reverses for the ${posted} posted payment${posted === 1 ? '' : 's'} and any invoice balances reopen. The ${scheduled} scheduled payment${scheduled === 1 ? '' : 's'} never posted, so ${scheduled === 1 ? 'it has' : 'they have'} no GL reversal.`;
  }
  return 'The GL reverses and any invoice balances reopen.';
}

/** The void dialog's wording for exactly these payments. */
export function paymentVoidOverride(payments: { status: string }[]): Partial<ReasonActionConfig> {
  return { ...PAYMENT_VOID_OVERRIDE, description: `${voidEffectText(payments)} A voided payment can't be reopened.` };
}

/* ── Mark as reversed, in bulk (user 10/22/26) ───────────────────────
 * Several payments at once use the vendor invoicing bulk action modal:
 * the same reason dialog, the selected payments listed with their total.
 * A single payment keeps the Reverse Payment modal. */
export const PAYMENT_REVERSE_OVERRIDE: Partial<ReasonActionConfig> = {
  targetLabel: 'Mark as Reversed',
  title: 'Reverse this payment?',
  description: 'Use this when the funds came back. The payment is marked Reversed.',
  // Ends in "payment" so a bulk run reads "Reverse 3 payments".
  actionText: 'Reverse Payment',
  countNoun: 'payment',
  reasons: [
    'Funds Returned by the Bank',
    'Payment Bounced or Was Rejected',
    'Sent to the Wrong Account',
    'Duplicate Payment',
    'Other',
  ],
  icon: ArrowLeftRight,
  notify: {
    label: 'Notify People',
    helper: "They'll be told these payments were reversed.",
    accentColor: 'hsl(var(--destructive))',
    accentBg: '#FEF2F2',
    accentBorder: '#FECACA',
    accentText: '#B91C1C',
  },
  descriptionPlaceholder: 'Why are these payments being reversed?',
  secondaryText: 'Keep Payments',
  listHrefBase: '/payments-v2/',
};
