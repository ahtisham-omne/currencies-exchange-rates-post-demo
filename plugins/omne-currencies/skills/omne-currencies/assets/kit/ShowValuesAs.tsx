import * as React from 'react';
import { Handshake, Landmark } from 'lucide-react';
import { getBaseCurrency } from './currencies';
import { BaseMoney, EstimateMoney, Money, type MoneyFx } from './Money';
import type { ColumnCurrencyView } from './columnCurrencyView';

/* ── OMNE currency kit: "Show values as" in a money column's menu ─────
 * Listings never get a Base | Party switch in their toolbar (25 Nov 2026).
 * Each money column's header menu gets this section instead, between the
 * sort options and Hide, exactly as the Partners listing has it:
 *
 *   ─────────────
 *   SHOW VALUES AS
 *   🏛 Base currency          ●
 *   🤝 Vendor currency
 *   ─────────────
 *
 * Only money columns get it. ColumnMoney renders a cell in the column's
 * view; sort and filter on the base value.
 *
 * The one exception (Nophil, 25 Nov 2026): a vendor invoice's amount
 * columns always show the invoice's own currency, the amount actually owed.
 * They get no "Show values as". Where a comparison is needed, add a
 * separate base column marked as an estimate: header estimateColumnLabel(),
 * cells EstimateMoney.
 *
 * Shared file. Do not edit it in a module. */

export type ColumnParty = 'partner' | 'vendor' | 'customer' | 'account';

const PARTY_OPTION_LABEL: Record<ColumnParty, string> = {
  partner: 'Partner currency',
  vendor: 'Vendor currency',
  customer: 'Customer currency',
  account: 'Account currency',
};

/** The menu section. Drop it into the module's column header menu, between
 *  Sort and Hide, for money columns only. `onPicked` closes the menu. */
export function ShowValuesAsSection({
  value,
  onChange,
  party,
  onPicked,
}: {
  value: ColumnCurrencyView;
  onChange: (view: ColumnCurrencyView) => void;
  party: ColumnParty;
  onPicked?: () => void;
}) {
  const options = [
    ['base', 'Base currency', Landmark],
    ['party', PARTY_OPTION_LABEL[party], Handshake],
  ] as const;
  return (
    <>
      <div className="border-t border-border/60 my-1" />
      <div className="px-2.5 pt-1 pb-0.5 text-[10.5px] text-muted-foreground/70 uppercase" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
        Show values as
      </div>
      {options.map(([v, text, Icon]) => (
        <button
          key={v}
          type="button"
          role="menuitemradio"
          aria-checked={value === v}
          onClick={() => {
            onChange(v);
            onPicked?.();
          }}
          className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
            value === v ? 'text-primary bg-primary/5' : 'text-foreground'
          }`}
        >
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span style={{ fontWeight: 400 }}>{text}</span>
          {value === v && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      ))}
    </>
  );
}

/**
 * A money cell in a listing, in its column's view: base (the record's
 * amount converted at its own rate, its own amount on hover) or the
 * record's own currency (base on hover). A base record reads the same
 * either way.
 */
export function ColumnMoney({
  view,
  value,
  currency,
  fx,
  role,
  className,
  children,
}: {
  view: ColumnCurrencyView;
  /** The amount in the record's own currency. */
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  /** For the hover: "Vendor currency". */
  role?: string;
  className?: string;
  /** A highlighted copy of the text (search); the hover stays. */
  children?: React.ReactNode;
}) {
  return view === 'base' ? (
    <BaseMoney value={value} currency={currency} fx={fx} role={role} className={className}>
      {children}
    </BaseMoney>
  ) : (
    <Money value={value} currency={currency} fx={fx} role={role} className={className}>
      {children}
    </Money>
  );
}

/** The header of a separate base column beside a real amount: "≈ Amount (PKR)". */
export const estimateColumnLabel = (label: string) => `≈ ${label} (${getBaseCurrency()})`;

/** The estimate cell for that column. */
export const EstimateCell = EstimateMoney;
