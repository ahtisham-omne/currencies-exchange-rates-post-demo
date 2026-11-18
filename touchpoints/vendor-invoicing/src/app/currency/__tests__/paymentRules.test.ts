import { describe, expect, it } from 'vitest';
import { mockInvoices } from '../../data/mockInvoices';
import { PAYMENT_FX_DEMO, PAY_FROM_ACCOUNTS, accountsForCurrency, defaultPayFromAccount } from '../../data/mockPayments';
import {
  bankConversionText,
  bankRateNeedsReview,
  buildPaymentGlFx,
  canPayFrom,
  costInBase,
  defaultPayFromCurrency,
  derivedRate,
  payFromBlockReason,
  payFromCurrencies,
  paymentRateOf,
  realizedFxFromGl,
  youPayInOf,
} from '../paymentRules';
import { paymentFx } from '../paymentFx';
import { SEED_RUNS } from '../../data/paymentRuns';
import { buildRunExecution, runGlRows } from '../../lib/runMath';

/* Paying a foreign invoice (Currency & Exchange Rates), in PKR with the
 * module's own GBP rates: the invoice rate Oct 16, 2025 is ₨340.6802. */

const INVOICE_RATE = 340.6802;
const sumOf = (side: 'debit' | 'credit', rows: { debit?: number; credit?: number }[]) =>
  Math.round(rows.reduce((s, r) => s + (r[side] ?? 0), 0) * 100) / 100;
const entry = (rows: { accountCode: string; debit?: number; credit?: number }[], code: string) => rows.find((r) => r.accountCode === code);

describe('Pay from: which accounts can pay', () => {
  it('only the invoice currency and the base (rules 3, 8)', () => {
    expect(payFromCurrencies('GBP')).toEqual(['GBP', 'PKR']);
    expect(payFromCurrencies('PKR')).toEqual(['PKR']);
    expect(canPayFrom('GBP', 'GBP')).toBe(true);
    expect(canPayFrom('PKR', 'GBP')).toBe(true);
    expect(canPayFrom('EUR', 'GBP')).toBe(false);
    expect(canPayFrom('USD', 'PKR')).toBe(false);
    const ids = accountsForCurrency(PAY_FROM_ACCOUNTS, 'GBP').map((a) => a.id);
    expect(ids).toContain('1060-GBP Settlement');
    expect(ids).toContain('1020-Payroll');
    expect(ids).not.toContain('1050-EUR Settlement');
    expect(ids).not.toContain('1040-FX Settlement');
  });

  it('greys the rest with the reason (rule 4)', () => {
    expect(payFromBlockReason('EUR', 'GBP')).toBe('This account is in EUR. Pick a GBP or PKR account.');
    expect(payFromBlockReason('USD', 'PKR')).toBe('This account is in USD. Pick a PKR account.');
    expect(payFromBlockReason('PKR', 'GBP')).toBeNull();
  });

  it("the PO's You pay in picks the default account (rule 5)", () => {
    expect(defaultPayFromCurrency('GBP', undefined)).toBe('PKR');
    expect(defaultPayFromCurrency('GBP', 'GBP')).toBe('GBP');
    // A You pay in that can't pay the invoice falls back to the base.
    expect(defaultPayFromCurrency('GBP', 'EUR')).toBe('PKR');
    const inv217 = mockInvoices.find((i) => i.invoiceNumber === 'INV-000217')!;
    const inv218 = mockInvoices.find((i) => i.invoiceNumber === 'INV-000218')!;
    expect(youPayInOf(inv217)).toBe('PKR');
    expect(youPayInOf(inv218)).toBe('GBP');
    expect(defaultPayFromAccount('GBP', inv218.youPayIn, 'bank').id).toBe('1060-GBP Settlement');
    expect(defaultPayFromAccount('GBP', inv217.youPayIn, 'bank').currency).toBe('PKR');
  });
});

describe('From a base account: the rate comes from the bank (rule 7)', () => {
  it('works out and writes the rate from the two figures', () => {
    expect(derivedRate(10000, 3503000)).toBeCloseTo(350.3, 10);
    expect(derivedRate(0, 3503000)).toBeNull();
    expect(bankConversionText(3503000, 10000, 'GBP')).toBe('₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR');
  });

  it('flags a bank rate past the allowed difference from the day', () => {
    // Oct 24, 2025 mid-market ₨349.2371: the bank's ₨350.3000 is 0.30% off.
    expect(bankRateNeedsReview(350.3, 349.2371, 1)).toBe(false);
    // Today's last synced ₨355.4200: 1.44% off.
    expect(bankRateNeedsReview(350.3, 355.42, 1)).toBe(true);
  });
});

describe('Payment GL: realized FX Gain/Loss', () => {
  it('from a base account: A/P at the invoice rate, the bank at what it took, a loss', () => {
    const { entries, fx } = buildPaymentGlFx({
      currency: 'GBP',
      lines: [{ invoiceNumber: 'INV-000219', amount: 10000, rate: INVOICE_RATE, rateDate: '2025-10-16' }],
      apAccount: '2000 Accounts Payable',
      cash: 10000,
      bankGl: '1020 Corporate Checking',
      accountCurrency: 'PKR',
      bankAmount: 3503000,
      paymentRate: 350.3,
      paymentDate: '2025-10-24',
    });
    expect(fx).toEqual({ carried: 3406802, credit: 0, cost: 3503000, amount: -96198 });
    expect(entry(entries, '2000')?.debit).toBe(3406802);
    expect(entry(entries, '1020')?.credit).toBe(3503000);
    expect(entry(entries, '7150')?.debit).toBe(96198);
    expect(sumOf('debit', entries)).toBe(sumOf('credit', entries));
    const desc = (entries.find((e) => e.accountCode === '7150') as { description?: string }).description;
    expect(desc).toContain('1 GBP = ₨340.6802 PKR (Oct 16, 2025)');
    expect(desc).toContain('1 GBP = ₨350.3000 PKR (Oct 24, 2025, bank conversion)');
  });

  it('from an account in the invoice currency: nothing converts, the day values it, a gain', () => {
    const { entries, fx } = buildPaymentGlFx({
      currency: 'GBP',
      lines: [{ invoiceNumber: 'INV-000220', amount: 6000, rate: INVOICE_RATE, rateDate: '2025-10-16' }],
      apAccount: '2000 Accounts Payable',
      cash: 6000,
      bankGl: '1060 GBP Settlement',
      accountCurrency: 'GBP',
      paymentRate: 337.9177,
      paymentDate: '2025-11-24',
    });
    expect(fx.amount).toBe(16575);
    expect(entry(entries, '1060')?.credit).toBe(2027506.2);
    expect(entry(entries, '7150')?.credit).toBe(16575);
    expect(sumOf('debit', entries)).toBe(sumOf('credit', entries));
  });

  it('vendor credit clears at the rate it was paid; the rest is the difference', () => {
    const { entries, fx } = buildPaymentGlFx({
      currency: 'GBP',
      lines: [{ invoiceNumber: 'INV-1', amount: 10000, rate: INVOICE_RATE }],
      apAccount: '2000 Accounts Payable',
      credits: [{ amount: 2000, rate: 344.9548, account: '1300 Vendor Prepayments' }],
      cash: 8000,
      bankGl: '1020 Corporate Checking',
      accountCurrency: 'PKR',
      bankAmount: 2800000,
      paymentRate: 350,
      paymentDate: '2025-10-24',
    });
    expect(entry(entries, '1300')?.credit).toBe(689909.6);
    expect(fx.amount).toBe(Math.round((3406802 - 689909.6 - 2800000) * 100) / 100);
    expect(sumOf('debit', entries)).toBe(sumOf('credit', entries));
  });

  it('a base-currency invoice converts nothing and posts no FX line', () => {
    const { entries, fx } = buildPaymentGlFx({
      currency: 'PKR',
      lines: [{ invoiceNumber: 'INV-2', amount: 50000, rate: 1 }],
      apAccount: '2000 Accounts Payable',
      cash: 50000,
      bankGl: '1010 Operating Bank',
      accountCurrency: 'PKR',
      paymentRate: 1,
      paymentDate: '2026-11-18',
    });
    expect(fx.amount).toBe(0);
    expect(entries.map((e) => e.accountCode)).toEqual(['2000', '1010']);
  });
});

describe('Seeded examples', () => {
  it('PMT-000121: INV-000219 from Corporate Checking, ₨3,503,000.00 → £10,000.00', () => {
    const p = PAYMENT_FX_DEMO.find((x) => x.paymentNumber === 'PMT-000121')!;
    expect(p.currency).toBe('GBP');
    expect(p.amount).toBe(10000);
    expect(p.bankAmount).toBe(3503000);
    expect(paymentRateOf(p)).toBeCloseTo(350.3, 10);
    expect(paymentFx(p).rate).toBeCloseTo(350.3, 10);
    expect(costInBase(p)).toBe(3503000);
    expect(realizedFxFromGl(p.glEntries)).toBe(-96198);
  });

  it('PMT-000122: INV-000220 from the GBP account, no conversion, a gain', () => {
    const p = PAYMENT_FX_DEMO.find((x) => x.paymentNumber === 'PMT-000122')!;
    expect(p.bankAmount).toBeUndefined();
    expect(p.exchangeRate).toBe(337.9177);
    expect(realizedFxFromGl(p.glEntries)).toBe(16575);
  });
});

describe('Payment runs keep the rules (rule 9)', () => {
  it('each run payment posts A/P at the invoice rates, the bank at its cost, and balances', () => {
    const run = SEED_RUNS.find((r) => r.status !== 'Completed' && r.groups.length > 0)!;
    const plan = buildRunExecution(run, 'Test', undefined, undefined, mockInvoices);
    expect(plan.records.length).toBeGreaterThan(0);
    plan.records.forEach((p) => {
      const rows = p.glEntries ?? [];
      expect(sumOf('debit', rows)).toBe(sumOf('credit', rows));
      // The vendor receives the invoices' currency, whichever account paid.
      const group = run.groups.find((g) => g.vendor === p.vendor && (g.currency ?? '').toUpperCase() === p.currency.toUpperCase());
      expect(group).toBeDefined();
      const account = PAY_FROM_ACCOUNTS.find((a) => a.id === p.bankAccount)!;
      expect(canPayFrom(account.currency, p.currency)).toBe(true);
    });
    const gl = runGlRows(run);
    const dr = Math.round(gl.reduce((s, r) => s + r.debit, 0) * 100) / 100;
    const cr = Math.round(gl.reduce((s, r) => s + r.credit, 0) * 100) / 100;
    expect(dr).toBe(cr);
  });

  it('a base account paying a GBP group records the bank figure and the rate from it', () => {
    const inv = mockInvoices.find((i) => i.invoiceNumber === 'INV-000217')!;
    const run = {
      ...SEED_RUNS[0],
      id: 'RUN-TEST',
      paymentDate: '2025-10-24',
      lines: [{ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, vendor: inv.vendor, currency: 'GBP', invoiceRate: INVOICE_RATE, invoiceRateDate: '2025-10-16', dueDate: inv.dueDate, balanceAtAdd: 10000, payAmount: 10000, apAccount: inv.apAccount }],
      groups: [{ vendor: inv.vendor, currency: 'GBP', methodId: '', methodType: 'Wire', payFromAccountId: '1020-Payroll', creditApplied: [], bankAmount: 3503000 }],
    };
    const plan = buildRunExecution(run, 'Test', undefined, undefined, mockInvoices);
    const p = plan.records[0];
    expect(p.currency).toBe('GBP');
    expect(p.amount).toBe(10000);
    expect(p.bankAmount).toBe(3503000);
    expect(p.exchangeRate).toBeCloseTo(350.3, 10);
    expect(realizedFxFromGl(p.glEntries)).toBe(-96198);
  });
});
