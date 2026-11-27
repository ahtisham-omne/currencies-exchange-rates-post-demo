import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { invoiceBaseEquivalent } from '@/app/currency/invoiceFx';
import type { Invoice } from '@/app/data/mockInvoices';
import { amountsText } from '@/app/components/payments/run/runMoney';

/* ── The invoice list's totals (Mahreen, 27 Nov 2026, 6a) ─────────────
 * The DataTable summary footer, over every invoice the filters and search
 * list (all pages, not the page): left, each currency's own total, never
 * converted ("By currency: AED 43,400.00 · €12,000.00 · ₨1,200,000.00 ·
 * $8,450.00", largest in base first, as a payment run lists them); right,
 * one base total of the Base Equivalent column: posted invoices at their
 * own rates, unposted ones at today's. "≈" only when an unposted foreign
 * invoice is in it. */

const round2 = (n: number) => Math.round(n * 100) / 100;

export function InvoiceTotalsSummary({ invoices }: { invoices: Invoice[] }) {
  const rows = invoices.map((inv) => ({ inv, ...invoiceBaseEquivalent(inv, inv.amount) }));
  const items = rows.map((r) => ({ currency: (r.inv.currency || BASE_CURRENCY).toUpperCase(), amount: r.inv.amount, base: r.base }));
  const byCurrency = amountsText(items);
  const total = round2(rows.reduce((s, r) => s + r.base, 0));
  const approx = rows.some((r) => r.estimate);
  return (
    <>
      <p className="min-w-0 truncate text-slate-500" title={byCurrency}>
        By currency: <span className="text-slate-700 tabular-nums">{byCurrency}</span>
      </p>
      <p className="shrink-0 text-slate-500 whitespace-nowrap">
        Total in base{' '}
        <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
          {approx ? '≈ ' : ''}
          {formatMoney(total, BASE_CURRENCY)}
        </span>
      </p>
    </>
  );
}
