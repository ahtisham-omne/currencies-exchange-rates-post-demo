/**
 * Saved payment method, as the partner module draws it.
 *
 * A port of `payment-methods/PaymentMethodCard.tsx` in omne-frontend, which
 * is what the purchase order's vendor card and its picker both render: the
 * icon chip with the method's summary title and its type badge, the Primary
 * chip, the method's own data rows on a tinted panel with each sensitive
 * value masked behind its own reveal toggle, the discount and charges strip,
 * and a footer carrying the category and the status.
 */

import { useState } from 'react';
import { Copy, Eye, EyeOff, Check, Pencil, Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import {
  formatDiscountValue,
  getEntryDataRows,
  getEntrySummary,
  maskValue,
  PAYMENT_CATEGORY_STYLE,
  paymentTypeMeta,
  type PaymentDataRow,
  type PaymentMethodEntry,
} from '@/app/data/vendorPaymentInstruments';

export function PaymentMethodCard({
  entry,
  isSelected = false,
  compact = false,
  onApply,
  onDuplicate,
  onEdit,
}: {
  entry: PaymentMethodEntry;
  /** Picker mode: the chosen card takes the brand ring and the check. */
  isSelected?: boolean;
  /** The sidebar's form: same card, tighter, without the footer. */
  compact?: boolean;
  /** Card click. Given one, the card is a picker tile. */
  onApply?: ((entry: PaymentMethodEntry) => void) | undefined;
  onDuplicate?: ((entry: PaymentMethodEntry) => void) | undefined;
  /** Hover pencil. */
  onEdit?: (() => void) | undefined;
}) {
  const meta = paymentTypeMeta(entry.type);
  const style = PAYMENT_CATEGORY_STYLE[meta.category];
  const Icon = meta.icon;
  const rows = getEntryDataRows(entry);
  const discountDisplay = entry.applyDiscount
    ? formatDiscountValue(entry.discountValue, entry.discountMode)
    : '';
  const chargesDisplay = entry.applyDiscount
    ? formatDiscountValue(entry.additionalCharges, entry.additionalChargesMode)
    : '';
  const showMoney = Boolean(discountDisplay || chargesDisplay);

  return (
    <div
      onClick={onApply ? () => onApply(entry) : undefined}
      className={`group relative flex flex-col rounded-xl bg-white text-left transition-all duration-200 ${
        onApply ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'border-[1.5px] border-primary shadow-[0_2px_12px_-4px_rgba(10,119,255,0.18)]'
          : entry.isPrimary
            ? 'border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)]'
            : 'border border-slate-200 hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
      }`}
    >
      {onApply && isSelected && (
        <span className="absolute -right-2 -top-2 z-10 flex w-5 h-5 items-center justify-center rounded-full bg-primary shadow-sm">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </span>
      )}

      <div className={`flex flex-1 flex-col gap-2 ${compact ? 'p-2.5' : 'p-3'}`}>
        {/* Header: icon + summary + type badge, then Primary or the pencil. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="flex w-7 h-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: style.chipBg, color: style.chipFg }}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="m-0 truncate leading-tight text-slate-900"
                style={{ fontSize: 12, fontWeight: 600 }}
                title={getEntrySummary(entry)}
              >
                {getEntrySummary(entry)}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="rounded-full px-1.5 py-px"
                  style={{
                    backgroundColor: style.badgeBg,
                    color: style.badgeFg,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {entry.isPrimary && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-white"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                <Star className="w-2.5 h-2.5 fill-white" />
                Primary
              </span>
            )}
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onEdit}
                    aria-label="Edit payment method"
                    className="cursor-pointer rounded-md p-1 opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                  >
                    <Pencil className="w-3 h-3 text-slate-400 hover:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]">
                  <p className="text-xs">Edit</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* The method's own data. */}
        {rows.length > 0 && (
          <div className="flex flex-col gap-[5px] rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
            {rows.map((row, i) => (
              <DataRow key={`${row.label}-${i}`} row={row} />
            ))}
          </div>
        )}

        {showMoney && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1">
            {discountDisplay && (
              <div className="inline-flex items-center gap-1" style={{ fontSize: 10 }}>
                <span className="text-slate-500" style={{ fontWeight: 500 }}>
                  Discount
                </span>
                <span className="text-slate-900 tabular-nums" style={{ fontWeight: 600 }}>
                  {discountDisplay}
                </span>
              </div>
            )}
            {chargesDisplay && (
              <div className="inline-flex items-center gap-1" style={{ fontSize: 10 }}>
                <span className="text-slate-500" style={{ fontWeight: 500 }}>
                  Charges
                </span>
                <span className="text-slate-900 tabular-nums" style={{ fontWeight: 600 }}>
                  {chargesDisplay}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <div
          className={`flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 ${
            onDuplicate ? '' : 'rounded-b-xl'
          }`}
        >
          <span className="text-slate-500" style={{ fontSize: 9, fontWeight: 500 }}>
            {meta.category}
          </span>
          <span
            className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-px text-emerald-700"
            style={{ fontSize: 9, fontWeight: 500 }}
          >
            {entry.status}
          </span>
        </div>
      )}

      {onDuplicate && (
        <div
          className="flex items-center rounded-b-xl border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onDuplicate(entry)}
            className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[12px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            style={{ fontWeight: 500 }}
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
        </div>
      )}
    </div>
  );
}

/** One data row, masked until its own eye is pressed. */
function DataRow({ row }: { row: PaymentDataRow }) {
  const [revealed, setRevealed] = useState(false);
  const Icon = row.icon;
  const displayed = row.sensitive && !revealed ? maskValue(row.value) : row.value;
  return (
    <div className="flex min-w-0 items-center gap-2" style={{ fontSize: 10 }}>
      <Icon className="w-3 h-3 shrink-0 text-slate-400" />
      <span className="shrink-0 text-slate-500" style={{ fontWeight: 500 }}>
        {row.label}
      </span>
      <span
        className="flex-1 truncate text-right text-slate-900 tabular-nums"
        style={{ fontWeight: 500, ...(row.sensitive ? { letterSpacing: '0.5px' } : {}) }}
      >
        {displayed}
      </span>
      {row.sensitive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRevealed((v) => !v);
          }}
          aria-label={revealed ? 'Hide value' : 'Reveal value'}
          className="shrink-0 cursor-pointer rounded p-0.5 transition-colors hover:bg-blue-50"
        >
          {revealed ? (
            <EyeOff className="w-2.5 h-2.5 text-slate-400" />
          ) : (
            <Eye className="w-2.5 h-2.5 text-slate-400" />
          )}
        </button>
      )}
    </div>
  );
}
