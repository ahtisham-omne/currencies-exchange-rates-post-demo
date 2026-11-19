/**
 * Additional charges, as the invoice create modal asks for them.
 *
 * Lifted out of `CreateInvoiceScreen` so more than one surface can carry it:
 * a card per charge with its type and amount, the description "Other" demands
 * because a catch-all with no context is a charge nobody can approve, a total
 * under a hairline, and the line saying where the money lands in the ledger.
 *
 * A return needs the same control for the opposite thing. On an invoice these
 * are amounts added to what we owe; on a return they are amounts the vendor
 * keeps back out of what they owe us -- restocking, return freight, an intake
 * fee. Same mechanics, opposite direction, so the words are the document's
 * (`totalLabel`, `addLabel`, `emptyNote`) and only the control is shared. The
 * return calls them Vendor charges.
 */

import { formatMoney as moneyIn, moneyPrefix } from '@/app/currency/money';
import { CheckCircle2, DollarSign, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export interface AdditionalCharge {
  id: number;
  type: string;
  amount: number;
  description?: string;
}

/** What an invoice gets charged. */
const DEFAULT_CHARGE_TYPES = [
  'Tax',
  'Service Fees',
  'Custom Charges',
  'Handling Fees',
  'Adjustments',
  'Insurance',
  'Fuel Surcharge',
  'Other',
];

/** What a vendor charges against a refund. Named for the return rather than
 *  borrowed from the invoice, where the common answers -- restocking, the
 *  freight back, the fee for booking the goods in -- were not on the list at
 *  all and tax and fuel surcharges were. */
export const VENDOR_CHARGE_TYPES = [
  'Restocking fee',
  'Return freight',
  'Intake fee',
  'Handling fee',
  'Inspection fee',
  'Other',
];

export function AdditionalChargesPanel({
  charges,
  onChange,
  glNote,
  totalLabel = 'Total Additional Charges',
  addLabel = 'Add charge',
  emptyNote = 'No additional charges. Add one below to get started.',
  types = DEFAULT_CHARGE_TYPES,
  descriptionError = false,
  onDescriptionErrorClear,
  currency = 'USD',
  formatTotal,
}: {
  charges: AdditionalCharge[];
  /** The document's currency, which the amounts are in. A return is in its
   *  PO's currency (app/currency/returnCurrency.ts). */
  currency?: string | undefined;
  onChange: (next: AdditionalCharge[]) => void;
  /** What happens to these amounts in the ledger, in this document's terms. */
  glNote: string;
  /** The same control answers two opposite questions. On an invoice these are
   *  amounts added to what we owe; on a return they are amounts the vendor
   *  keeps back out of what they owe us. The mechanics are identical and the
   *  words are not, so the document names them. */
  totalLabel?: string;
  /** Writes the total another way, e.g. in PKR (Create New RMA, step 5). */
  formatTotal?: ((total: number) => string) | undefined;
  addLabel?: string;
  emptyNote?: string;
  /** What kinds there are to pick from. An invoice is charged tax and fuel
   *  surcharges; a return is docked a restocking fee and the freight back.
   *  Offering a return the invoice's list made the common answers unpickable
   *  and the pickable ones nonsense. */
  types?: string[];
  /** Set when a save found an "Other" with no description. */
  descriptionError?: boolean;
  onDescriptionErrorClear?: (() => void) | undefined;
}) {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return (
    <>
{/* Charge rows: each line is a compact type select +
    amount input + subtle remove. No per-column headers
    because the placeholders carry the meaning. "Add
    charge" is a quiet primary-colored link at the
    bottom instead of a big dashed button. Total sits
    below a hairline as a right-aligned summary. */}
{/* Each charge is its own clean card with a tinted
    header strip (icon tile + "Charge N" title + remove
    X) and a white body holding labeled fields. Mirrors
    the partner module's Pricing & Ordering Rules card
    recipe so users get the same visual rhythm across
    both flows. */}
<div className="space-y-2.5">
  {charges.map((charge, index) => (
    <div
      key={charge.id}
      className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-amber-200 hover:shadow-[0_4px_12px_-4px_rgba(245,158,11,0.10)] animate-in fade-in slide-in-from-top-1 duration-200"
    >
      {/* Header strip — icon tile + charge type as the
          heading (falls back to "New Charge" when the
          type isn't picked yet) + delete. Drops the
          "Charge N" count + duplicate type chip so the
          header carries one piece of identity. */}
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-100"
        style={{ background: 'linear-gradient(90deg, #FFF7ED 0%, #FFFBEB 100%)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded bg-white border border-orange-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-2.5 h-2.5 text-orange-600" />
          </div>
          <span
            className={`text-[11px] truncate ${charge.type ? 'text-foreground' : 'text-slate-400 italic'}`}
            style={{ fontWeight: 600 }}
          >
            {charge.type || 'New Charge'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(charges.filter((c) => c.id !== charge.id))}
          className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 transition-colors hover:text-red-500 hover:bg-red-50"
          aria-label="Delete charge"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Body — tighter padding so the card stays
          compact in the narrow sidebar. */}
      <div className="p-2.5 space-y-2">
        {/* Row 1: Type + Amount, 50/50 split */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Type</Label>
            <Select
              value={charge.type}
              onValueChange={(value) => {
                onChange(charges.map((c, i) => (i === index ? { ...c, type: value } : c)));
              }}
            >
              <SelectTrigger className="h-8 w-full bg-white border-slate-200 text-[11px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t} className="text-[12px]">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Amount</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>{moneyPrefix(currency).trim()}</span>
              <Input
                type="number"
                value={charge.amount || ''}
                onChange={(e) => {
                  const amount = Number(e.target.value);
                  onChange(charges.map((c, i) => (i === index ? { ...c, amount } : c)));
                }}
                className="pl-5 h-8 bg-white border-slate-200 text-[11px] tabular-nums shadow-none text-right pr-2 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300"
                placeholder="0.00"
                style={{ fontWeight: 500 }}
              />
            </div>
          </div>
        </div>

        {/* "Other" is a catch-all — it requires a
            description so approvers know what the
            charge actually is (design review 7/9/26). */}
        {charge.type === 'Other' && (
          <div className="space-y-1" id={`charge-description-${charge.id}`}>
            <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
              Description<span className="text-red-500">*</span>
            </Label>
            <Input
              value={charge.description || ''}
              onChange={(e) => {
                const description = e.target.value;
                onChange(charges.map((c, i) => (i === index ? { ...c, description } : c)));
                if (descriptionError && description.trim()) onDescriptionErrorClear?.();
              }}
              placeholder="What is this charge for?"
              className={`h-8 bg-white text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300 ${
                descriptionError && !(charge.description || '').trim()
                  ? 'border-red-400 ring-1 ring-red-100'
                  : 'border-slate-200'
              }`}
              style={{ fontWeight: 500 }}
            />
            {descriptionError && !(charge.description || '').trim() && (
              <p className="text-[10px] text-red-500" style={{ fontWeight: 500 }}>Describe the charge, "Other" needs context.</p>
            )}
          </div>
        )}

      </div>
    </div>
  ))}

  {/* Empty state — no charge exists yet. The user opts in
      to each charge instead of the modal pre-selecting Tax. */}
  {charges.length === 0 && (
    <p className="text-[11px] text-slate-400 text-center py-1" style={{ fontWeight: 500 }}>
      {emptyNote}
    </p>
  )}

  {/* New cards start fully blank — empty type, $0 amount —
      so every field shows its placeholder. */}
  {charges.length < 5 && (
    <button
      type="button"
      onClick={() => onChange([...charges, { id: Date.now(), type: '', amount: 0 }])}
      className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-slate-300 bg-white text-[11px] text-slate-500 hover:border-amber-400 hover:bg-amber-50/60 hover:text-amber-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
      style={{ fontWeight: 500 }}
    >
      <Plus className="w-3 h-3" />
      {charges.length === 0 ? addLabel : 'Add another'}
    </button>
  )}

  <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{totalLabel}</span>
    <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
      {formatTotal ? formatTotal(total) : moneyIn(total, currency)}
    </span>
  </div>

  {/* No per-charge GL to map — for inventory invoices the
      charges are capitalised into the inventory value
      (ASC 330) and roll into the Inventory debit line in
      GL Impact. Standalone invoices have no inventory, so
      they're expensed instead. */}
  <div className="flex items-start gap-1.5 pt-2">
    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
    <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
      {glNote}
    </span>
  </div>
</div>
    </>
  );
}
