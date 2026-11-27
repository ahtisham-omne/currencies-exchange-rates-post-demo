import { AlertTriangle, ArrowRightLeft } from 'lucide-react';
import type { Payment } from '@/app/data/mockPayments';
import { needsBankRate } from '@/app/currency/paymentLedger';
import { localTodayIso } from '@/app/lib/dueBucket';

/* ── The bank's rate is due (27 Nov 2026, Mahreen 7e) ─────────────────
 * On a scheduled payment's date, a payment the bank converts asks for the
 * rate the bank gave: "PMT-000124 was scheduled for today. Once it's paid,
 * enter the rate the bank gave you." with Enter Rate, which opens Mark as
 * paid (MarkPaidDialog). On Payment History and on the invoice's Payments
 * tab. The status-banner recipe of the invoice page (StatusReasonBanner):
 * white card, amber border, icon tile, one CTA in the banner's colour. */

/** Scheduled payments due today that the bank converts. */
export function bankRateDueToday(payments: Payment[]): Payment[] {
  const today = localTodayIso();
  return payments.filter((p) => p.status === 'Scheduled' && p.paymentDate === today && needsBankRate(p));
}

export function BankRateDueBanner({ payments, onEnterRate, className = '' }: { payments: Payment[]; onEnterRate: (payment: Payment) => void; className?: string }) {
  if (payments.length === 0) return null;
  return (
    <div className={`rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${className}`} style={{ borderColor: '#FDE68A' }}>
      <div className="divide-y divide-amber-100">
        {payments.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: '#B45309' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                {p.paymentNumber} was scheduled for today.
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">Once it's paid, enter the rate the bank gave you.</p>
            </div>
            <button
              type="button"
              onClick={() => onEnterRate(p)}
              className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              style={{ fontWeight: 600 }}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Enter Rate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
