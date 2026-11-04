import { mulberry32 } from './seededRandom';
import { mockInvoices } from './mockInvoices';
import { paymentMethodsForVendor } from './mockVendors';
import { formatPaymentId } from '@/app/lib/invoiceIds';

// Seeded so the listing renders the same 100 payments on every reload —
// mirrors mockInvoices' approach. Bump the seed if a future schema change
// needs a fresh dataset.
const rand = mulberry32(0x9A43E28);
// Separate stream for the audit fields (Last Updated By/On) so adding
// them doesn't shift the main sequence and reshuffle the whole dataset.
const auditRand = mulberry32(0x0A0D17);
// Dedicated stream deciding whether a paid/reversed payment was
// SCHEDULED first (feedback 7/22/26) — its own seed so the timeline
// flag doesn't reshuffle the rest of the dataset.
const schedRand = mulberry32(0x5C4EDD);

// PRD — Vendor Payments (with Prepayments).
// Two transaction types under one module:
//   Payment    — settles open vendor invoices. GL: Dr A/P, Cr Bank.
//   Prepayment — an advance before/without an invoice, optionally tied
//                to a PO. GL: Dr Prepayment (OCA), Cr Bank. A/P untouched
//                until applied (Dr A/P, Cr Prepayment).

export type PaymentType = 'Payment' | 'Prepayment';

// Payment lifecycle:    Scheduled → Paid, with Cancelled (stopped before
// sending) and Reversed (completed then returned, e.g. bounced transfer) as side exits.
// (No approval step; no failed/returned state.) "Partially Paid" is an invoice
// state, not a payment state.
// Prepayment lifecycle: Unapplied → Partially applied → Fully applied → (Cancelled)
// Refunded was retired as a status (design feedback 7/16/26).
export const PAYMENT_STATUSES = [
  'Scheduled',
  'Paid',
  'Reversed',
  'Cancelled',
] as const;
export const PREPAYMENT_STATUSES = [
  'Unapplied',
  'Partially Applied',
  'Fully Applied',
  'Cancelled',
] as const;

/* ── Two-axis payment state (Eli review 7/15/26) ─────────────────────
 * Status and application-of-funds are orthogonal: a scheduled payment
 * can be unapplied. Both axes derive from the record. */

/** Status axis — payments carry it directly; a prepayment's money has
 *  gone out, so it reads Paid unless it was Cancelled. */
export function paymentStatusAxis(p: Payment): string {
  if (p.type === 'Prepayment') {
    if (p.status === 'Cancelled') return p.status;
    return 'Paid';
  }
  return p.status;
}

/** Application-of-funds axis, derived from the applied amount. */
export function paymentApplicationAxis(p: Payment): string {
  if (p.appliedAmount <= 0.004) return 'Unapplied';
  if (p.appliedAmount >= p.amount - 0.004) return 'Fully Applied';
  return 'Partially Applied';
}

export interface AppliedInvoiceRef {
  invoiceNumber: string;
  amount: number;
}

/** Vendor credit consumed by this payment, by source prepayment — the
 *  bridge the 9/20/26 reviews found missing: it keeps the credit line in
 *  the saved journal and lets a reversal restore the source's balance. */
export interface AppliedCreditRef {
  sourcePaymentId: string;
  sourcePaymentNumber: string;
  amount: number;
}

/** How each covered invoice was settled: cash vs credit. Lets the
 *  invoice's Payments tab show the true split and lets a reversal
 *  reopen EVERY covered invoice, not just the one it started from. */
export interface PerInvoiceSplit {
  invoiceNumber: string;
  cash: number;
  credit: number;
}

/** GL snapshot from the shared posting rule (lib/glPosting.ts). */
export interface PaymentGlEntry {
  accountCode: string;
  accountName: string;
  description?: string;
  debit?: number;
  credit?: number;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  type: PaymentType;
  vendor: string;
  /** Date the payment was issued (yyyy-mm-dd) — the true payment date used for
   *  bank-statement matching, even when posted to a later open period. */
  paymentDate: string;
  /** Date the record was created — drives the insights range filter. */
  createdDate: string;
  paymentMethod: string;
  bankAccount: string;
  apAccount: string;
  amount: number;
  /** Invoices this payment settled / this prepayment has been applied to. */
  appliedInvoices: AppliedInvoiceRef[];
  appliedAmount: number;
  /** Prepayments: the advance still sitting unapplied (the OCA balance). */
  unappliedAmount: number;
  /** Prepayment-only: optional PO association for later auto-apply. */
  linkedPO?: string;
  /** Prepayment-only: pre-invoice this advance is anchored to (when recorded
   *  "against a pre-invoice"). Empty for on-account advances. */
  preInvoiceId?: string;
  /** Prepayment-only: when linked to a pre-invoice, suggest this advance on the
   *  payment once that pre-invoice converts to a real invoice. Defaults to true. */
  autoApply?: boolean;
  currency: string;
  /** Check number / ACH trace number / wire confirmation. */
  reference: string;
  memo: string;
  /** Short memo line that prints on the check / transmits in the ACH/wire
   *  field — distinct from the long-form `memo` (description). Character-
   *  limited per instrument; defaults to a traceable stamp when left blank. */
  printMemo?: string;
  status: string;
  /** Payment run grouping (7/23/26): payments approved together on a run
   *  share a runId; each stays an individual per-vendor payment. runApprovedBy
   *  / runLabel carry the run's approval trail for the Scheduled tab. */
  runId?: string;
  runLabel?: string;
  runApprovedBy?: string;
  /** True when the payment was SCHEDULED before it paid (future-dated),
   *  so the lifecycle timeline shows Scheduled → Paid. A payment recorded
   *  for today/past is paid directly and shows just Paid (feedback
   *  7/22/26). */
  wasScheduled?: boolean;
  createdBy: string;
  /** Audit trail: last touch. Optional so UI-created records fall back
   *  to created-by/on (a fresh record's last update IS its creation). */
  updatedDate?: string;
  updatedBy?: string;
  /** Vendor credit consumed alongside cash (9/22/26 review response). */
  appliedCredits?: AppliedCreditRef[];
  /** Cash/credit split per covered invoice. `appliedInvoices` stays the
   *  cash-only view for back-compat with existing readers. */
  perInvoiceSplit?: PerInvoiceSplit[];
  /** GL snapshot taken at creation from the shared posting rule. */
  glEntries?: PaymentGlEntry[];
  /** Check-method payments only (Eli 9/25; 10/5 spec): who confirmed the
   *  check printed (or logged writing it by hand) and when. Absent on a
   *  check payment ⇒ the check is UNPRINTED. 'void' marks a voided check
   *  awaiting reprint. The payment status (Paid / Void / Reversed) is
   *  separate and never changes because of printing. */
  checkPrint?: { status: 'printed' | 'manual' | 'void'; by: string; at: string };
}

// Same vendor universe as mockInvoices/mockVendors so pickers, hover
// cards, and "top vendor" KPIs tell one consistent story.
const vendors = [
  'Global Logistics Partners',
  'Tech Innovations Supply',
  'Premium Materials Corp',
  'Swift Distribution Ltd',
  'Quality Components Inc',
  'Metro Wholesale Group',
  'Pacific Trading Co',
  'Elite Suppliers Network',
  'Acme Supplies Co.',
  'Premier Automotive',
  'Tech Components Inc.',
  'Global Materials Corp',
  'Midwest Manufacturing',
  'Pacific Steel Works',
  'Atlantic Electronics',
  'Summit Distribution',
  'Valley Wholesale',
  'Mountain Equipment Co.',
  'Coastal Logistics LLC',
  'Northern Trading Group',
  'Southern Industrial Supply',
  'Eastern Parts Depot',
  'Western Manufacturing Inc.',
  'Central Warehouse Solutions',
  'Metro Office Supplies',
  'Urban Industrial Group',
  'Rural Equipment Co.',
  'Suburban Services Inc.',
];

const methods = ['Bank Transfer', 'ACH', 'Wire', 'Check', 'Card', 'Cash'];

// All seven payment methods offered in the creation screen, plus the type of
// pay-from account each draws from. The method filters the Pay-from Account
// dropdown and drives the GL credit side. ('Other' allows any account.)
export type PayFromType = 'bank' | 'card' | 'cash' | 'any';
export const PAYMENT_METHODS: { value: string; accountType: PayFromType }[] = [
  { value: 'Check', accountType: 'bank' },
  { value: 'ACH', accountType: 'bank' },
  { value: 'Wire', accountType: 'bank' },
  { value: 'Bank Transfer', accountType: 'bank' },
  { value: 'Card', accountType: 'card' },
  { value: 'Cash', accountType: 'cash' },
  { value: 'Other', accountType: 'any' },
];
export function accountTypeForMethod(method: string): PayFromType {
  return PAYMENT_METHODS.find((m) => m.value === method)?.accountType ?? 'any';
}

// Same convention as mockInvoices (feedback 7/16/26; Irtaza above Rida
// 8/12/26): the first listing rows are pinned to Ahtisham, Eli,
// Mahreen, Irtaza, Rida in order; the rest draw from the whole roster.
const PINNED_CREATORS = ['Ahtisham Ahmad', 'Eli Rosenbloom', 'Mahreen Ghafoor', 'Irtaza Abid', 'Rida Iftikhar'];
const users = [
  ...PINNED_CREATORS,
  'John Smith',
  'Sarah Johnson',
  'Mike Wilson',
  'Emily Brown',
  'David Lee',
  'Jessica Martinez',
  'Robert Chen',
  'Amanda White',
];

// Pay-from accounts the payment can draw from, tagged by type so the chosen
// method can filter the dropdown (bank methods → bank accounts, Card → Card
// Payable, Cash → Petty Cash). `creditGl` is the GL account credited when
// paying from it (debit is always A/P).
export interface PayFromAccount {
  id: string;
  label: string;
  balance: number;
  type: 'bank' | 'card' | 'cash';
  creditGl: string;
  /** The bank this account is linked to in Cash Management (omitted for cash). */
  bankName?: string;
  /** Last 4 of the linked account number, shown masked (••••4321). */
  accountMask?: string;
  /** Human account type from Cash Management (Checking / Savings / etc.). */
  accountTypeLabel?: string;
  /** Credit accounts only: the card's limit. `balance` then reads as the
   *  AVAILABLE credit, so pickers show "Available $X of $Y" instead of a
   *  meaningless book balance (design review 7/9/26). */
  creditLimit?: number;
}

/** Per-type balance line for account pickers: card accounts show available
 *  credit against the limit, bank and cash accounts their actual balance. */
export function accountBalanceLabel(acct: PayFromAccount, fmtMoney: (n: number) => string): string {
  if (acct.type === 'card' && acct.creditLimit) {
    return `Available ${fmtMoney(acct.balance)} of ${fmtMoney(acct.creditLimit)}`;
  }
  return fmtMoney(acct.balance);
}
// Linked-bank / account-number / type fields mirror the Cash Management banking
// page, so the Pay-from picker shows the same account identity the treasury team
// sees there. `creditGl` is the GL account credited (debit is always A/P).
export const PAY_FROM_ACCOUNTS: PayFromAccount[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', balance: 1_240_000, type: 'bank', creditGl: '1010 Operating Bank', bankName: 'JPMorgan Chase', accountMask: '4321', accountTypeLabel: 'Checking' },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', balance: 380_000, type: 'bank', creditGl: '1020 Corporate Checking', bankName: 'Bank of America', accountMask: '8842', accountTypeLabel: 'Checking' },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', balance: 615_000, type: 'bank', creditGl: '1030 AP Disbursements', bankName: 'U.S. Bank', accountMask: '2025', accountTypeLabel: 'Checking' },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', balance: 92_000, type: 'bank', creditGl: '1040 FX Settlement', bankName: 'Wells Fargo', accountMask: '7741', accountTypeLabel: 'Money Market' },
  // Bank-named disbursement accounts so the Pay-from default snaps to the
  // vendor's primary payment-method bank (e.g. a PNC Bank ACH method →
  // "1200 PNC Bank"). Bank names match vendorPaymentMethods' BANKS list.
  { id: '1200-PNC Bank', label: '1200 · PNC Disbursements', balance: 540_000, type: 'bank', creditGl: '1200 PNC Bank', bankName: 'PNC Bank', accountMask: '3318', accountTypeLabel: 'Checking' },
  { id: '1210-Citibank', label: '1210 · Citibank Operating', balance: 470_000, type: 'bank', creditGl: '1210 Citibank', bankName: 'Citibank', accountMask: '6620', accountTypeLabel: 'Checking' },
  { id: '1220-Chase Bank', label: '1220 · Chase Disbursements', balance: 880_000, type: 'bank', creditGl: '1220 Chase Bank', bankName: 'Chase Bank', accountMask: '1174', accountTypeLabel: 'Checking' },
  { id: '2100-Card Payable', label: '2100 · Amex Card Payable', balance: 36_000, creditLimit: 50_000, type: 'card', creditGl: '2100 Card Payable', bankName: 'American Express', accountMask: '1009', accountTypeLabel: 'Credit Card' },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', balance: 3_500, type: 'cash', creditGl: '1000 Cash on Hand', accountTypeLabel: 'Cash on Hand' },
];
// Bank-only subset kept for the data generator + any bank-specific consumers.
export const BANK_ACCOUNTS = PAY_FROM_ACCOUNTS.filter((a) => a.type === 'bank');

const memos = [
  'Weekly AP payment run',
  'Net-30 settlement',
  'Partial payment per agreement',
  'Early-pay discount capture',
  'Consolidated multi-invoice payment',
  'Wire settlement - international vendor',
  'Month-end close payment batch',
  'Advance on order confirmation',
  'Deposit per contract terms',
  'Quarterly services retainer',
];

// Weighted status draws — most payments live at Paid, most prepayments
// still carry an unapplied balance (they feed Prepayments Outstanding).
function drawPaymentStatus(): string {
  const r = rand();
  // Draft payments no longer exist (Eli review 7/15/26).
  if (r < 0.30) return 'Scheduled';
  if (r < 0.88) return 'Paid';
  // Reversed: completed then returned (bounced/failed transfer).
  if (r < 0.94) return 'Reversed';
  return 'Cancelled';
}
function drawPrepaymentStatus(): string {
  const r = rand();
  if (r < 0.4) return 'Unapplied';
  if (r < 0.65) return 'Partially Applied';
  if (r < 0.9) return 'Fully Applied';
  return 'Cancelled';
}

function refFor(method: string): string {
  if (method === 'Check') return `CHK-${String(40000 + Math.floor(rand() * 9000))}`;
  if (method === 'Wire') return `WIRE-${String(700000 + Math.floor(rand() * 90000))}`;
  if (method === 'ACH') return `ACH-${String(900000 + Math.floor(rand() * 90000))}`;
  if (method === 'Card') return `CARD-${String(5000 + Math.floor(rand() * 4000))}`;
  if (method === 'Cash') return `CASH-${String(1000 + Math.floor(rand() * 9000))}`;
  return `TRF-${String(300000 + Math.floor(rand() * 90000))}`;
}

// Seeded payments may only claim application to invoices whose own row
// acknowledges received money (9/15/26): the listing's Payment Status and
// the detail page's journey both read the invoice row as the source of
// truth, so an application against an Unpaid invoice made the two
// surfaces disagree. Pool = invoices seeded Partially Paid / Paid in
// Full; the first listing rows stay fresh by construction (they seed as
// Pending Approval / Approved).
const PAID_INVOICE_POOL = mockInvoices
  .filter(
    (i) =>
      (i.status === 'Partially Paid' || i.status === 'Paid in Full') &&
      i.type !== 'Pre-Invoice',
  )
  .map((i) => i.invoiceNumber);
const paidPoolPick = (n: number) => PAID_INVOICE_POOL[n % PAID_INVOICE_POOL.length];

function generatePayments(count: number): Payment[] {
  const payments: Payment[] = [];
  const today = new Date();
  const SPAN_DAYS = 365;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - SPAN_DAYS);

  for (let i = 0; i < count; i++) {
    const paymentDate = new Date(startDate);
    paymentDate.setDate(startDate.getDate() + Math.floor((i / count) * SPAN_DAYS));
    const createdDate = new Date(paymentDate);
    createdDate.setDate(paymentDate.getDate() + Math.floor(rand() * 2));

    // ~28% prepayments; first row is always a fresh Unapplied prepayment
    // so the listing leads with the advance story.
    const type: PaymentType = i === 0 ? 'Prepayment' : rand() < 0.28 ? 'Prepayment' : 'Payment';
    const vendor = vendors[Math.floor(rand() * vendors.length)];
    const method = methods[Math.floor(rand() * methods.length)];
    // Pick a pay-from account whose type matches the method (Card → Card
    // Payable, Cash → Petty Cash, bank methods → a bank account).
    const acctPool = PAY_FROM_ACCOUNTS.filter((a) => a.type === accountTypeForMethod(method));
    const payFromPool = acctPool.length ? acctPool : BANK_ACCOUNTS;
    const bankAccount = payFromPool[Math.floor(rand() * payFromPool.length)].id;
    // rand() is drawn either way so the seeded stream stays identical
    // whether or not the row is pinned.
    const randomCreator = users[Math.floor(rand() * users.length)];
    const createdBy = i < PINNED_CREATORS.length ? PINNED_CREATORS[i] : randomCreator;
    const amount = Math.floor(rand() * 45000) + 2500;
    const status = type === 'Payment'
      ? (i === 1 ? 'Paid' : drawPaymentStatus())
      : (i === 0 ? 'Unapplied' : drawPrepaymentStatus());

    // Applied invoices + prepayment economics per status
    let appliedAmount = 0;
    const appliedInvoices: AppliedInvoiceRef[] = [];
    if (type === 'Payment') {
      // A payment carries its allocation from the start; it only
      // counts as settled once Paid, but the plan is always visible.
      if (status !== 'Cancelled') {
        const invCount = Math.floor(rand() * 3) + 1;
        let remaining = amount;
        for (let j = 0; j < invCount; j++) {
          const isLast = j === invCount - 1;
          const slice = isLast ? remaining : Math.round(remaining * (rand() * 0.4 + 0.2));
          remaining -= slice;
          appliedInvoices.push({
            // Drawn from the paid-acknowledging pool so the target
            // invoice's own status backs the application (9/15/26).
            invoiceNumber: paidPoolPick(i * 7 + j * 13),
            amount: slice,
          });
        }
        appliedAmount = status === 'Paid' ? amount : 0;
      }
    } else {
      // Prepayment: how much of the advance has been consumed so far.
      if (status === 'Partially Applied') appliedAmount = Math.round(amount * (rand() * 0.5 + 0.2));
      else if (status === 'Fully Applied') appliedAmount = amount;
      if (appliedAmount > 0) {
        const invCount = appliedAmount === amount ? Math.floor(rand() * 2) + 1 : 1;
        let remaining = appliedAmount;
        for (let j = 0; j < invCount; j++) {
          const isLast = j === invCount - 1;
          const slice = isLast ? remaining : Math.round(remaining * 0.6);
          remaining -= slice;
          appliedInvoices.push({
            // Same paid-acknowledging pool as payments (9/15/26).
            invoiceNumber: paidPoolPick(i * 11 + j * 17),
            amount: slice,
          });
        }
      }
    }
    const unappliedAmount =
      type === 'Prepayment' && (status === 'Unapplied' || status === 'Partially Applied')
        ? Math.round((amount - appliedAmount) * 100) / 100
        : 0;

    payments.push({
      id: `pmt-${i + 1}`,
      // One sequence for payments and advances (10/29): PMT-000001, PMT-000002, ...
      paymentNumber: formatPaymentId(i + 1),
      type,
      vendor,
      paymentDate: paymentDate.toISOString().split('T')[0],
      createdDate: createdDate.toISOString().split('T')[0],
      paymentMethod: method,
      bankAccount,
      apAccount: type === 'Prepayment' ? '1300-Vendor Prepayments' : '2000-Accounts Payable',
      amount,
      appliedInvoices,
      appliedAmount,
      unappliedAmount,
      linkedPO: type === 'Prepayment' && rand() < 0.5 ? String(2000 + Math.floor(rand() * 900)) : undefined,
      currency: 'USD',
      reference: refFor(method),
      memo: memos[Math.floor(rand() * memos.length)],
      status,
      // A currently-scheduled payment IS scheduled; a paid/reversed one
      // was scheduled first only ~1/3 of the time, the rest paid directly
      // (spec lifecycle 7/22/26). Prepayments are never scheduled.
      wasScheduled:
        type === 'Payment' &&
        (status === 'Scheduled' || ((status === 'Paid' || status === 'Reversed') && schedRand() < 0.34)),
      createdBy,
      ...(() => {
        // Last touch lands between creation and today; a different
        // teammate than the creator about half the time.
        const updated = new Date(createdDate);
        updated.setDate(createdDate.getDate() + Math.floor(auditRand() * 45));
        if (updated > today) updated.setTime(today.getTime());
        return {
          updatedDate: updated.toISOString().split('T')[0],
          updatedBy: auditRand() < 0.5 ? createdBy : users[Math.floor(auditRand() * users.length)],
        };
      })(),
      // Check-print trail (Eli 9/25): most seeded checks were confirmed
      // printed the day they paid; every 5th reads as a hand-written
      // manual check; every 7th stays UNPRINTED so the amber detail state
      // is reachable in the demo.
      ...(method === 'Check' && i % 7 !== 3
        ? {
            checkPrint: {
              status: (i % 5 === 0 ? 'manual' : 'printed') as 'printed' | 'manual',
              by: createdBy,
              at: paymentDate.toISOString().split('T')[0],
            },
          }
        : {}),
    });
  }

  return payments;
}

// ── Anchored prepayments (feedback 7/14/26) ────────────────────────────
// A prepayment is recorded against either a pre-invoice or the vendor
// account. The generator above only produces on-account advances, so a few
// Unapplied ones are re-anchored here to real payable pre-invoices from the
// invoice seed: preInvoiceId + autoApply drive the "prepayment attached"
// chip in the payment picker and the locked auto-apply in step 2.
function anchorPrepaymentsToPreInvoices(payments: Payment[]): Payment[] {
  // Anchored demos must be UNMISSABLE on the run's Step 2 (8/28/26
  // evening): the proposal's first accordion is Check, so the anchors
  // target open invoices of CHECK-primary vendors — one anchor each
  // across several vendors, pre-invoices first. Any run that picks one
  // of these invoices shows an auto-applied prepayment right where the
  // page opens.
  const seen = new Set<string>();
  const picks = mockInvoices
    .filter(
      (inv) =>
        (inv.status === 'Approved' || inv.status === 'Partially Paid') &&
        inv.outstandingBalance > 0 &&
        inv.type !== 'Standalone' &&
        paymentMethodsForVendor(inv.vendor).primary === 'Check',
    )
    .sort((a, b) => (a.type === 'Pre-Invoice' ? 0 : 1) - (b.type === 'Pre-Invoice' ? 0 : 1))
    .filter((inv) => (seen.has(inv.vendor) ? false : (seen.add(inv.vendor), true)))
    .slice(0, 6);
  const anchorable = payments.filter((p) => p.type === 'Prepayment' && p.status === 'Unapplied');
  picks.forEach((inv, i) => {
    const p = anchorable[i];
    if (!p) return;
    // The advance is a sensible partial deposit: 40% of the outstanding
    // balance, rounded to whole dollars.
    const advance = Math.max(500, Math.round(inv.outstandingBalance * 0.4));
    p.vendor = inv.vendor;
    p.preInvoiceId = inv.invoiceNumber;
    p.autoApply = true;
    p.amount = advance;
    p.unappliedAmount = advance;
    p.linkedPO = inv.linkedPOs?.[0];
    p.memo = `Deposit against ${inv.invoiceNumber}`;
  });
  return payments;
}

// The pay flow lists vendors by open payable due (desc), so the FIRST
// card is the vendor with the largest outstanding. Guarantee that vendor
// demos the whole prepayment story (feedback 7/22/26): a few on-account
// advances to pick from PLUS one or two anchored to a pre-invoice that
// auto-apply. Seeded deterministically for whoever tops the list.
function seedFirstVendorPrepayments(payments: Payment[]): Payment[] {
  const payable = (inv: (typeof mockInvoices)[number]) =>
    (inv.status === 'Approved' || inv.status === 'Partially Paid' || inv.status === 'Pending Approval') &&
    inv.outstandingBalance > 0 &&
    !inv.is_payment_held;
  const due: Record<string, number> = {};
  mockInvoices.forEach((i) => {
    if (payable(i)) due[i.vendor] = (due[i.vendor] ?? 0) + i.outstandingBalance;
  });
  const first = Object.entries(due).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!first) return payments;

  const now = new Date();
  const ago = (n: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  const mk = (n: number, amount: number, extra: Partial<Payment>): Payment => ({
    id: `pmt-seed-fv-${n}`,
    paymentNumber: formatPaymentId(101 + n),
    type: 'Prepayment',
    vendor: first,
    paymentDate: ago(18 + n * 7),
    createdDate: ago(18 + n * 7),
    paymentMethod: 'Wire',
    bankAccount: '1010-Operating',
    apAccount: '1300-Vendor Prepayments',
    amount,
    appliedInvoices: [],
    appliedAmount: 0,
    unappliedAmount: amount,
    currency: 'USD',
    reference: `WIRE-${String(760000 + n * 137)}`,
    memo: 'On-account advance, available to apply',
    status: 'Unapplied',
    createdBy: 'Ahtisham Ahmad',
    wasScheduled: false,
    ...extra,
  });

  // 3 on-account advances to choose from ($1,000 / $3,000 / $5,000).
  const onAccount = [1000, 3000, 5000].map((amt, i) => mk(i + 1, amt, {}));

  // 1 to 2 advances anchored to the vendor's own open invoices so the
  // "invoice-level prepayment" case always demos. Pre-invoices are the
  // natural target, but any open order-based invoice works (the anchor is
  // just a preInvoiceId → invoiceNumber link); standalone bills excluded.
  const anchored = mockInvoices
    .filter(
      (inv) =>
        inv.vendor === first &&
        (inv.status === 'Approved' || inv.status === 'Partially Paid') &&
        inv.outstandingBalance > 0 &&
        inv.type !== 'Standalone',
    )
    .sort((a, b) => (a.type === 'Pre-Invoice' ? 0 : 1) - (b.type === 'Pre-Invoice' ? 0 : 1))
    .slice(0, 2)
    .map((inv, i) => {
      const advance = Math.max(500, Math.round(inv.outstandingBalance * 0.4));
      return mk(10 + i, advance, {
        preInvoiceId: inv.invoiceNumber,
        autoApply: true,
        linkedPO: inv.linkedPOs?.[0],
        memo: `Deposit against ${inv.invoiceNumber}`,
      });
    });

  return [...onAccount, ...anchored, ...payments];
}

export const mockPayments = seedFirstVendorPrepayments(
  anchorPrepaymentsToPreInvoices(generatePayments(100)),
);
