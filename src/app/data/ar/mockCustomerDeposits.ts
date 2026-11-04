// Customer deposits: advances received against advance invoices, held as
// a LIABILITY (2400 Customer Deposits) until applied to a shipment
// invoice (spec §6). A dedicated array, not overloaded payment records:
// a deposit's lifecycle spans documents (received on a PRE, applied to
// one or more INVs, possibly refunded), so it owns its applications.

export type DepositStatus = 'Held' | 'Partially Applied' | 'Fully Applied' | 'Refunded';

export interface DepositAppliedTo {
  invoiceNumber: string;
  amount: number;
  appliedOn: string;
}

export interface CustomerDeposit {
  id: string;
  depositNumber: string;
  customer: string;
  /** Preferred scoping tag — SO-matched deposits sort first when applying (spec §6.3). */
  soNumber?: string;
  /** The advance invoice the deposit was received against. */
  preInvoiceNumber?: string;
  receivedDate: string;
  method: string;
  reference: string;
  amount: number;
  refunded?: boolean;
  refundedOn?: string;
  /** FAD 11/2: money returned to the customer so far (partial refunds). */
  refundedAmount?: number;
  refundReason?: string;
  applications: DepositAppliedTo[];
}

import { mockCustomerInvoices } from './mockCustomerInvoices';

const today = new Date();
// The story deposit equals the 30% advance actually billed on SO 2021.
const storyAdvance = mockCustomerInvoices.find((i) => i.invoiceNumber === 'INV-000088')?.amount ?? 18400;
const storyBalance = mockCustomerInvoices.find((i) => i.invoiceNumber === 'INV-000103');
const storyCovered = storyBalance?.advanceReferences?.[0]?.amount ?? storyAdvance;
const daysFromToday = (n: number) => {
  const d = new Date(today);
  d.setDate(today.getDate() + n);
  return d.toISOString().split('T')[0];
};

const storyDeposits: CustomerDeposit[] = [
  // The 30% deposit paid against advance INV-000088 (SO 2021). The
  // balance invoice INV-000103 billed only the uncovered 70%, and its
  // GL releases this deposit for the covered share (BR-009).
  {
    id: 'dep-1',
    depositNumber: 'DEP-000007',
    customer: 'Coastal Logistics LLC',
    soNumber: '2021',
    preInvoiceNumber: 'INV-000088',
    receivedDate: daysFromToday(-34),
    method: 'Wire',
    reference: 'WIRE-448211',
    amount: storyAdvance,
    applications: [{ invoiceNumber: 'INV-000103', amount: storyCovered, appliedOn: daysFromToday(-20) }],
  },
  // An on-account deposit held for Rural Equipment Co.
  {
    id: 'dep-2',
    depositNumber: 'DEP-000009',
    customer: 'Rural Equipment Co.',
    soNumber: '2002',
    receivedDate: daysFromToday(-15),
    method: 'ACH',
    reference: 'ACH-902114',
    amount: 12000,
    applications: [],
  },
  // A partially applied deposit, remainder still held.
  {
    id: 'dep-3',
    depositNumber: 'DEP-000011',
    customer: 'Metro Wholesale Group',
    receivedDate: daysFromToday(-48),
    method: 'Wire',
    reference: 'WIRE-501773',
    amount: 7500,
    applications: [{ invoiceNumber: 'INV-000143', amount: 4200, appliedOn: daysFromToday(-30) }],
  },
  // A refunded advance — the order was cancelled after payment (spec §6.3).
  {
    id: 'dep-4',
    depositNumber: 'DEP-000013',
    customer: 'Premier Automotive',
    receivedDate: daysFromToday(-70),
    method: 'ACH',
    reference: 'ACH-337045',
    amount: 5250,
    refunded: true,
    applications: [],
  },
];

// FAD 11/2: every paid advance invoice has the deposit it received, so
// Refund Prepayment always has a record to pick. Settlements at shipment
// draw the deposit down on the same invoice. Deterministic numbering.
const paidAdvances = mockCustomerInvoices.filter(
  (i) => i.docKind === 'Advance Invoice' && i.depositReceived && !storyDeposits.some((d) => d.preInvoiceNumber === i.invoiceNumber),
);
const derivedDeposits: CustomerDeposit[] = paidAdvances.map((a, idx) => ({
  id: `dep-adv-${a.id}`,
  depositNumber: `DEP-${String(20 + idx).padStart(6, '0')}`,
  customer: a.customer,
  soNumber: a.linkedSOs[0],
  preInvoiceNumber: a.invoiceNumber,
  receivedDate: a.sentAt ? a.sentAt.split('T')[0] : a.invoiceDate,
  method: idx % 2 === 0 ? 'Wire' : 'ACH',
  reference: `${idx % 2 === 0 ? 'WIRE' : 'ACH'}-${String(610000 + idx * 137)}`,
  amount: a.amount,
  applications: (a.settlements ?? []).map((x) => ({ invoiceNumber: a.invoiceNumber, amount: x.amount, appliedOn: x.date })),
}));

export const mockCustomerDeposits: CustomerDeposit[] = [...storyDeposits, ...derivedDeposits];
