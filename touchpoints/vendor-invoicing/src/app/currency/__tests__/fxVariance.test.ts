import { describe, expect, it } from 'vitest';
import { buildInvoiceGl } from '../../lib/glPosting';
import { mockInvoices } from '../../data/mockInvoices';
import { postInvoiceGl } from '../glFx';
import { fxVarianceOf, invoiceFxVariance } from '../fxVariance';

/* The FX Variance cases (Currency & Exchange Rates), in PKR with the
 * module's own GBP rates: received Oct 5, 2025 at ₨344.1448, invoiced Oct 16
 * at ₨340.6802, a prepayment paid Oct 2 at ₨344.9548. */

const RECEIVED = { date: '2025-10-05', amount: 10000, rate: 344.1448 };
const INVOICE_RATE = 340.6802;
const PREPAID = { invoiceNumber: 'PRE-000003', amount: 5000, rate: 344.9548, rateDate: '2025-10-02' };

const gl = (prepaid = 0, billed = 10000) =>
  buildInvoiceGl({
    kind: 'received',
    lines: [{ glAccount: '1200 Inventory', amount: billed, accrualAmount: 10000, varianceAmount: 0, priceVarianceAmount: billed - 10000 }],
    freightAmount: 0,
    freightGlAccount: '5020 Freight Inbound',
    additionalChargesTotal: 0,
    additionalChargeGlAccount: '6000 General & Admin',
    apAccount: '2000 Accounts Payable',
    total: billed,
    sliceAdjustedTotal: billed,
    sliceFraction: 1,
    prepaymentApplied: prepaid,
  });

const line = (rows: { code: string; amount: number }[], code: string) => rows.find((r) => r.code === code)?.amount;

describe('FX Variance at invoice', () => {
  it('no prepayment: the rate difference on the goods is a gain', () => {
    const v = fxVarianceOf({ currency: 'GBP', invoiceRate: INVOICE_RATE, invoiceDate: '2025-10-16', receipts: [RECEIVED] })!;
    const posted = postInvoiceGl(gl(), { currency: 'GBP', rate: INVOICE_RATE, variance: v });
    expect(line(posted.debits, '2100')).toBe(3441448);
    expect(line(posted.credits, '2000')).toBe(3406802);
    expect(line(posted.credits, '5215')).toBe(34646);
  });

  it('a prepayment keeps its locked rate; only the unpaid rest makes a variance', () => {
    const prepayments = [PREPAID];
    const v = fxVarianceOf({ currency: 'GBP', invoiceRate: INVOICE_RATE, invoiceDate: '2025-10-16', receipts: [RECEIVED], prepayments })!;
    const posted = postInvoiceGl(gl(5000), { currency: 'GBP', rate: INVOICE_RATE, variance: v, prepayments });
    expect(line(posted.debits, '2100')).toBe(3445498);
    expect(line(posted.credits, '1205')).toBe(1724774);
    expect(line(posted.credits, '2000')).toBe(1703401);
    expect(line(posted.credits, '5215')).toBe(17323);
  });

  it('a prepayment covering the whole invoice leaves no variance and nothing on A/P', () => {
    const prepayments = [{ ...PREPAID, amount: 10000 }];
    const v = fxVarianceOf({ currency: 'GBP', invoiceRate: INVOICE_RATE, invoiceDate: '2025-10-16', receipts: [RECEIVED], prepayments })!;
    const posted = postInvoiceGl(gl(10000), { currency: 'GBP', rate: INVOICE_RATE, variance: v, prepayments });
    expect(v.amount).toBe(0);
    expect(posted.credits.find((r) => r.role === 'fxVariance')).toBeUndefined();
    expect(posted.credits.find((r) => r.role === 'payable')).toBeUndefined();
    expect(line(posted.debits, '2100')).toBe(line(posted.credits, '1205'));
  });

  it('a price difference goes to Purchase Price Variance at the invoice rate, apart from the rate difference', () => {
    const v = fxVarianceOf({ currency: 'GBP', invoiceRate: INVOICE_RATE, invoiceDate: '2025-10-16', receipts: [RECEIVED] })!;
    const posted = postInvoiceGl(gl(0, 10500), { currency: 'GBP', rate: INVOICE_RATE, variance: v });
    expect(line(posted.debits, '5210')).toBe(170340.1);
    expect(line(posted.credits, '5215')).toBe(34646);
    const dr = posted.debits.reduce((s, r) => s + r.amount, 0);
    const cr = posted.credits.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(dr * 100)).toBe(Math.round(cr * 100));
  });

  it('the seeded examples carry those journals', () => {
    const plain = mockInvoices.find((i) => i.invoiceNumber === 'INV-000217')!;
    const prepaid = mockInvoices.find((i) => i.invoiceNumber === 'INV-000218')!;
    expect(invoiceFxVariance(plain)?.amount).toBe(34646);
    expect(invoiceFxVariance(prepaid)?.amount).toBe(17323);
    expect(prepaid.outstandingBalance).toBe(5000);
    expect(prepaid.glEntries?.find((e) => e.accountCode === '1205')?.credit).toBe(1724774);
  });
});
