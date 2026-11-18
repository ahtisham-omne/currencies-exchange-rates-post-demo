/**
 * How many units of a line come back.
 *
 * The return used to be answered a bill at a time, which put the same three
 * questions on the card once per invoice. It asks them once now: one quantity
 * for the line -- typed, or picked by name where the units are named -- and
 * one reason and remedy covering it.
 *
 * The documents are still stated, because a returner is checked in against a
 * receipt and credited against a bill, and both need naming. They are stated
 * rather than asked: which receipts and which invoices the units come off
 * follows from how many are coming back, not the other way round.
 *
 * Colour is spent only on invoice status. Nothing else on the card is tinted,
 * so slate, amber and emerald mean one thing here -- unbilled, billed, paid --
 * rather than doubling as a decoration for whichever section is in use.
 */

import { RotateCcw, ScanLine } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { DatePicker } from '@/app/components/ui/date-picker';
import { OverflowTooltip } from '@/app/components/data-table/OverflowTooltip';
import { SLICE_STATE_CHIP, SLICE_STATE_LABELS, type SliceState } from '@/app/data/receiptInvoices';

/** A document the units come off, named on the card but not asked about.
 *  It reads the same whatever is picked: the order, the receipt and the
 *  billing state are facts about the line, not consequences of the count. */
export type DocChip = {
  key: string;
  label: string;
  detail: string;
  /** Present on invoices, absent on receipts: only a bill has a status. */
  state?: SliceState | undefined;
};

/** How many chips sit inline before the rest fold into "+N more". */
const CHIPS_INLINE = 3;

function ChipRow({ label, chips }: { label: string; chips: DocChip[] }) {
  if (chips.length === 0) return null;
  const inline = chips.slice(0, CHIPS_INLINE);
  const rest = chips.slice(CHIPS_INLINE);
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</Label>
      <div className="flex items-center gap-1 min-w-0">
        {inline.map((chip) => (
          <span
            key={chip.key}
            title={chip.detail}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] whitespace-nowrap shrink-0 ${
              chip.state
                ? SLICE_STATE_CHIP[chip.state]
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
            style={{ fontWeight: 600 }}
          >
            {chip.label}
          </span>
        ))}
        {rest.length > 0 && (
          <OverflowTooltip
            category={label}
            items={rest.map((chip) => ({ id: chip.key, name: chip.label, subtitle: chip.detail }))}
          >
            <span
              className="text-[10px] cursor-pointer transition-colors shrink-0 hover:underline"
              style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
            >
              +{rest.length} more
            </span>
          </OverflowTooltip>
        )}
      </div>
    </div>
  );
}

export function ReturnUnitsCard({
  uom,
  available,
  qty,
  credit,
  noReceipts,
  purchaseOrders,
  receipts,
  invoices,
  onQtyChange,
  expectedResolution,
  onExpectedResolutionChange,
  onPickUnits,
  onReturnAll,
  onClear,
  reasons,
  reason,
  onReasonChange,
  type,
  typeOptions,
  onTypeChange,
  vendorResolved = true,
}: {
  uom: string;
  available: number;
  qty: number;
  credit: number;
  /** Stock with no receiver behind it: there are no receivings for the return
   *  to leave against, so the line cannot say there are. */
  noReceipts?: boolean;
  purchaseOrders: DocChip[];
  receipts: DocChip[];
  invoices: DocChip[];
  onQtyChange: (next: number) => void;
  /** When the credit is expected to settle. A forecast the user can move, so
   *  it arrives as an ISO date with a setter rather than as text. */
  expectedResolution: string;
  onExpectedResolutionChange: (next: string) => void;
  /** Serialized lines return named units, so the quantity is the count picked
   *  in the serial modal rather than a typed number. */
  onPickUnits?: (() => void) | undefined;
  onReturnAll: () => void;
  onClear: () => void;
  reasons: readonly string[];
  reason: string;
  onReasonChange: (next: string) => void;
  type: string;
  typeOptions: { type: string; disabled?: boolean }[];
  onTypeChange: (next: string) => void;
  /** Whether the vendor behind this line is settled yet. Starting from the
   *  item, it often is not: the part is known, the supplier is chosen on the
   *  next step. Until then there is no order, no receipt and no bill to name,
   *  and naming one vendor's paperwork on a part five vendors ship would be
   *  a guess dressed up as a fact. */
  vendorResolved?: boolean;
}) {
  const active = qty > 0;
  // A quantity of nothing is the one state that needs answering, and a plain
  // "0" in a neutral box reads as an answer already given. While it is empty
  // the field asks -- primary border, a ring, and a prompt where the figure
  // goes -- and goes quiet the moment there is a number in it. The colour
  // carries that on its own; a line of copy under it only repeated the point.
  const billed = invoices.filter((i) => i.state && i.state !== 'not-invoiced').length;

  return (
    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 shrink-0">
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Units returning</p>
            <p className="text-[11px] text-slate-500 mt-px">
              {noReceipts
                ? 'How much of this stock is going back, up to everything on hand.'
                : !vendorResolved
                  ? 'How much of this part comes back, up to everything received.'
                  : billed > 0
                    ? 'How much comes back, and the documents it settles against.'
                    : 'How much comes back, and the receivings it leaves against.'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="tabular-nums leading-none">
            <span
              className={`text-[20px] ${active ? 'text-emerald-700' : 'text-slate-300'}`}
              style={{ fontWeight: 700 }}
            >
              {qty}
            </span>
            <span className="text-[11px] text-slate-500 ml-1" style={{ fontWeight: 500 }}>
              of {available} {uom}
            </span>
          </p>
          <p
            className={`text-[11px] tabular-nums mt-1 ${active ? 'text-foreground' : 'text-slate-400'}`}
            style={{ fontWeight: 600 }}
          >
            ${credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="border-t border-[#EEF2F6] bg-white">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC]">
          <p className="text-[11px] text-slate-500 truncate">
            {!vendorResolved
              ? 'Set how much comes back. The vendor is chosen next.'
              : billed > 1
                ? `Billed across ${billed} invoices`
                : 'Set how much of this line comes back.'}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onReturnAll}
              className="h-6 px-2 rounded-md text-[11px] text-primary hover:bg-primary/5 transition-colors"
              style={{ fontWeight: 600 }}
            >
              Return all
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={!active}
              className="h-6 px-2 rounded-md text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              style={{ fontWeight: 600 }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 items-start">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Units returning</Label>
            {onPickUnits ? (
              /* Named units are chosen, not counted, so the field is a way into
                 the picker rather than something to type in. */
              <button
                type="button"
                onClick={onPickUnits}
                aria-label="Select units to return"
                className={`h-11 w-full rounded-md border px-3 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-300 bg-white'
                    : 'border-primary/60 bg-primary/[0.03] ring-2 ring-primary/10 hover:bg-primary/[0.06]'
                }`}
              >
                <span
                  className={`truncate ${active ? 'text-[16px] tabular-nums text-emerald-700' : 'text-[13px] text-primary'}`}
                  style={{ fontWeight: active ? 700 : 600 }}
                >
                  {active ? `${qty} ${uom}` : 'Select units to return'}
                </span>
                <ScanLine className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-primary'}`} />
              </button>
            ) : (
              <label
                className={`h-11 w-full rounded-md border px-3 flex items-center gap-2 cursor-text transition-colors ${
                  active
                    ? 'border-emerald-300 bg-white focus-within:ring-1 focus-within:ring-emerald-100'
                    : 'border-primary/60 bg-primary/[0.03] ring-2 ring-primary/10 focus-within:ring-primary/25'
                }`}
              >
                <Input
                  type="number"
                  min={0}
                  max={available}
                  value={active ? qty : ''}
                  placeholder="Enter quantity"
                  aria-label="Units returning"
                  onChange={(e) =>
                    onQtyChange(Math.min(Math.max(0, Number(e.target.value) || 0), available))
                  }
                  className={`h-9 flex-1 min-w-0 border-0 bg-transparent p-0 text-left text-[16px] md:text-[16px] tabular-nums shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[13px] placeholder:text-primary/60 placeholder:font-medium ${
                    active ? 'text-emerald-700' : 'text-foreground'
                  }`}
                  style={{ fontWeight: 700 }}
                />
                {/* The unit trails the figure, the way the date field trails
                    its icon: what is being typed leads, and what it is
                    measured in sits at the edge. */}
                <span className="text-[12px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{uom}</span>
              </label>
            )}
          </div>

          {/* The forecast belongs with the quantity, not off in a card of its
              own: both are things the user sets about this line. It stays in
              the plain palette the reason and remedy use, since a date is not
              a quantity and should not read as one. */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Expected resolution date
            </Label>
            {/* The design-system picker rather than the browser's: same ISO
                contract, but it reads "Nov 20, 2026" instead of a slash-
                separated date whose day and month order depends on the
                viewer's locale. */}
            <DatePicker
              value={expectedResolution}
              onChange={onExpectedResolutionChange}
              placeholder="Pick a date"
              className="h-11 w-full text-[12px] rounded-md"
            />
          </div>
          </div>

          {/* The reason, on its own: the type is no longer asked. */}
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Reason</Label>
              <Select value={reason} onValueChange={onReasonChange}>
                <SelectTrigger className="h-9 text-[12px] bg-white border-slate-200 hover:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-md">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="text-[12px] z-[220]">
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* The paper trail, once the decisions are made. A returner is
              raised against an order, checked in against a receipt and
              credited against a bill, so all three are named -- but none of
              them is a question, and they sit under the answers. */}
          {vendorResolved && (
          <div className="pt-3 space-y-3 border-t border-[#F1F5F9]">
            <ChipRow
              label={purchaseOrders.length === 1 ? 'Purchase order' : 'Purchase orders'}
              chips={purchaseOrders}
            />
            <ChipRow
              label={receipts.length === 1 ? 'Receiving document' : 'Receiving documents'}
              chips={receipts}
            />
            {/* The chips carry billing state rather than document numbers, so
                the row is labelled for what it actually says. */}
            <ChipRow label="Invoice status" chips={invoices} />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { SLICE_STATE_LABELS };
