import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { DatePicker } from '@/app/components/ui/date-picker';
import { localTodayIso } from '@/app/lib/dueBucket';
import { checkSettingsFor, recordChecks, updateCheckSettings } from '@/app/lib/checkPrinting';
import type { Payment } from '@/app/data/mockPayments';

/* ── Manual check (10/5 spec step 8) ─────────────────────────────────
 * A check written by hand instead of printed: the number lands in the
 * register and as the payment's reference, and the payment leaves the
 * unprinted list. One modal for the record-payment success modal and
 * the payment detail page (user 10/15: still reachable after the
 * success modal is closed). */

export function ManualCheckModal({
  payment,
  onClose,
  onLogged,
}: {
  payment: Payment | null;
  onClose: () => void;
  onLogged?: (checkNumber: number) => void;
}) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    if (!payment) return;
    setNumber(String(checkSettingsFor(payment.bankAccount).nextCheckNumber));
    setDate(payment.paymentDate);
  }, [payment]);

  if (!payment) return null;

  const log = () => {
    const n = parseInt(number, 10);
    if (!n) {
      toast.error('Check number needed', { description: 'Enter the number you wrote on the check.' });
      return;
    }
    const written = date || payment.paymentDate;
    payment.reference = String(n);
    payment.checkPrint = { status: 'manual', by: 'Ahtisham Ahmad', at: written || localTodayIso() };
    recordChecks([{
      number: n,
      bankAccountId: payment.bankAccount,
      status: 'Issued',
      payee: payment.vendor,
      amount: payment.amount,
      date: written,
      paymentRef: payment.paymentNumber,
      printedBy: 'Ahtisham Ahmad',
      printedAt: written || localTodayIso(),
    }]);
    const next = checkSettingsFor(payment.bankAccount).nextCheckNumber;
    if (n >= next) updateCheckSettings(payment.bankAccount, { nextCheckNumber: n + 1 });
    toast.success(`Manual check ${n} logged`, { description: 'Recorded in the register and off the unprinted list.' });
    onLogged?.(n);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
      <div
        className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#2563EB', filter: 'blur(50px)' }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
            <Printer className="w-8 h-8" style={{ color: '#1D4ED8' }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            Manual Check
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>
            Log a Hand-Written Check
          </h3>
          <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '320px' }}>
            For {payment.paymentNumber} to {payment.vendor}. Omne records the number in the check register and takes the payment off the unprinted list.
          </p>
          <div className="w-full mt-5 grid grid-cols-2 gap-3 text-left">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Check Number</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                className="h-9 text-[12px] bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Date Written</Label>
              <DatePicker value={date} onChange={(d) => setDate(d || payment.paymentDate)} />
            </div>
          </div>
          <div className="w-full mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={log}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
              style={{ fontWeight: 600, backgroundColor: '#1D4ED8' }}
            >
              Log Manual Check
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100"
              style={{ fontWeight: 500, color: '#334155' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
