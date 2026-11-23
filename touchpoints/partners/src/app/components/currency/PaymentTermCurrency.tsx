import { exampleDocumentCurrency } from "@/app/currency/partnerCurrency";
import { CurrencyFlag } from "./CurrencyFlag";

/* ── Payment terms work in any currency ────────────────────────────────
 * Currency Touchpoints Map, Partners §4: a payment term is days and
 * percentages only, no fixed amounts, so the same term applies unchanged on
 * a document in any currency. The comparison shows a term as it is set and
 * as it reads on a PO in the partner's currency (US dollars for a partner in
 * the base currency): the two columns match.
 *
 *   Term          Set as           On a USD PO
 *   Net 30        30 days          30 days
 *   2/10 Net 30   2% in 10 days    2% in 10 days                         */

export interface PaymentTermLike {
  category: "net" | "prepayment" | "split";
  /** Net: days until payment is due. */
  duration?: string;
  /** Net: early-payment discount, a percentage, and the days it applies within. */
  discountPercent?: string;
  discountPeriod?: string;
  /** Prepayment: the percentage paid up front, and when. */
  prepayPercent?: string;
  trigger?: string;
  /** Split: each installment's percentage and when it is due. */
  milestones?: { pct: string; label: string }[];
}

export interface PaymentTermRow {
  term: string;
  setAs: string;
}

const num = (v: string | undefined) => (v ?? "").replace(/%$/, "").trim();
const lower = (v: string | undefined) => (v ?? "").trim().toLowerCase();

/** A term's parts as rows: "Net 30 · 30 days", "2/10 Net 30 · 2% in 10 days". */
export function paymentTermRows(t: PaymentTermLike): PaymentTermRow[] {
  if (t.category === "net") {
    const days = num(t.duration);
    if (!days) return [];
    const rows: PaymentTermRow[] = [{ term: `Net ${days}`, setAs: `${days} days` }];
    const pct = num(t.discountPercent);
    const period = num(t.discountPeriod);
    if (pct && period) rows.push({ term: `${pct}/${period} Net ${days}`, setAs: `${pct}% in ${period} days` });
    return rows;
  }
  if (t.category === "prepayment") {
    const pct = num(t.prepayPercent) || "100";
    const when = lower(t.trigger);
    return [{ term: "Prepayment", setAs: when ? `${pct}% at ${when}` : `${pct}% up front` }];
  }
  return (t.milestones ?? [])
    .filter((m) => num(m.pct))
    .map((m, i) => ({ term: `Installment ${i + 1}`, setAs: m.label ? `${num(m.pct)}% at ${lower(m.label)}` : `${num(m.pct)}%` }));
}

/**
 * The comparison table: Term | Set as | On a {currency} PO. `partnerCurrency`
 * is the partner's (or group's) currency, a code or stored id; base or none
 * shows a US-dollar PO as the example.
 */
export function PaymentTermCurrencyTable({
  term,
  partnerCurrency,
  className,
}: {
  term: PaymentTermLike;
  partnerCurrency?: string | null;
  className?: string;
}) {
  const rows = paymentTermRows(term);
  if (!rows.length) return null;
  const code = exampleDocumentCurrency(partnerCurrency);
  const th = "px-3 py-2 text-[11px] text-slate-500";
  const td = "px-3 py-2 text-[12px] text-slate-700 tabular-nums";
  return (
    <div className={className}>
      <div className="rounded-xl border border-[#E8ECF1] bg-white overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E8ECF1]">
              <th className={`${th} text-left`} style={{ fontWeight: 600 }}>Term</th>
              <th className={`${th} text-left`} style={{ fontWeight: 600 }}>Set as</th>
              <th className={`${th} text-right`} style={{ fontWeight: 600 }}>
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <CurrencyFlag code={code} />On a {code} PO
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i > 0 ? "border-t border-[#F1F5F9]" : undefined}>
                <td className={`${td} text-foreground`} style={{ fontWeight: 500 }}>{r.term}</td>
                <td className={td}>{r.setAs}</td>
                <td className={`${td} text-right`}>{r.setAs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
        Days and percentages only, no fixed amounts, so the term applies the same on a document in any currency.
      </p>
    </div>
  );
}
