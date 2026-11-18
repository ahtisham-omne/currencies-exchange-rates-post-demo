/**
 * How the credit for one vendor's goods settles.
 *
 * The step groups by part, so a vendor shows up inside several part cards, and
 * where the money lands belongs to the vendor rather than to any one of those
 * parts. Entering it in the card would have entered it once per card. This is
 * the one place it lives.
 *
 * It carries neither the vendor's identity nor the parts. The identity is in
 * the sheet's heading, which is what the sheet is scoped by, and the parts are
 * the card this was opened from. Physical routing -- which of their addresses,
 * which carrier -- is not settled here either: that is a shipment's question,
 * asked when the goods actually move, and answering it on a draft credit note
 * was two flows wearing one form.
 *
 * The fields follow the purchasing line-edit modal's pattern: the label above
 * the control in small caps, two up where they fit, one across where they do
 * not.
 */

import { Building2, Hash, Landmark, Lock, Truck } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { formatQty } from '@/app/components/vendorSelectionModel';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReturnVendorCard({
  vendorName,
  rmaNumber,
  onRmaNumber,
  payToLabel,
  onEditPayTo,
  glAccount,
}: {
  /** Only to label the controls. The heading states who this is with. */
  vendorName: string;
  rmaNumber: string;
  onRmaNumber: (next: string) => void;
  /** Where the credit lands, and the account it books against. Both follow the
   *  vendor rather than the part, and both were missing from this sheet. */
  payToLabel: string;
  onEditPayTo: () => void;
  glAccount: string;
}) {
  return (
    // The same shell as Notes and Supporting Documents, because it sits beside
    // them and answers the same kind of question about the line. It was a
    // full-width block under both, which read as a footer to the sheet rather
    // than as one more thing being set.
    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 shrink-0">
          <Landmark className="w-3.5 h-3.5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>How it settles with them</p>
          <p className="text-[11px] text-slate-500 mt-px">Where the credit lands, and the number they gave it.</p>
        </div>
      </div>
      <div className="border-t border-[#EEF2F6] px-4 py-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="min-w-0">
            <span className="mb-1.5 block text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
              Refund account
            </span>
            <button
              type="button"
              onClick={onEditPayTo}
              className="w-full h-9 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-foreground transition-colors hover:border-primary/40"
            >
              <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate flex-1 text-left">{payToLabel || 'Not set'}</span>
              <span className="text-[11px] text-primary shrink-0" style={{ fontWeight: 600 }}>Change</span>
            </button>
            {/* "Pay-to" read as money we send out, the opposite of a refund
                (Nophil, 23 Oct; ERP-8714). */}
            <p className="mt-1 text-[10px] text-slate-400">
              Where the vendor's refund is expected to land. Set on the partner.
            </p>
          </div>

          <div className="min-w-0">
            <span className="mb-1.5 block text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
              GL A/P account
            </span>
            {/* Derived from the vendor's category, not chosen. Stated so the
                credit's accounting is visible where it is decided. */}
            <div className="w-full h-9 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="truncate">{glAccount || 'Not mapped'}</span>
            </div>
          </div>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
              Their RMA number
            </span>
            <div className="relative">
              <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={rmaNumber}
                onChange={(e) => onRmaNumber(e.target.value)}
                placeholder={`Authorisation number from ${vendorName}`}
                aria-label={`RMA number from ${vendorName}`}
                className="h-9 pl-8 text-[12px]"
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
