import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { Handshake, Landmark } from 'lucide-react';
import { BaseMoney, Money, type MoneyFx } from './Money';

/* ── "Show values as" on a mixed-currency table's money columns (25 Nov 2026) ──
 * An item's vendor list and its sales orders mix currencies: each row is
 * kept in its vendor's (or order's) own currency. Each money column's header
 * menu has "Show values as", as the Partners listing does: Base currency
 * shows every row in the base currency (the default, so rows compare at a
 * glance); "<Party> currency" shows each row in its own. The other figure is
 * always on the amount's hover. A read-only view choice per column, never an
 * edit; kept for the session per table and column (keyed "qv:<item id>:<column>",
 * "sales-orders:<column>"), so leaving the tab and coming back keeps it.
 * Sorting reads the base figures either way. Replaces the table toolbar's
 * Base Currency | <Party> Currency switch. */

export type RowView = 'base' | 'row';

const views = new Map<string, RowView>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setRowView(key: string, view: RowView) {
  if ((views.get(key) ?? 'base') === view) return;
  views.set(key, view);
  listeners.forEach((l) => l());
}

/** The table whose money columns offer "Show values as". Outside one (or with
 *  a null key, e.g. on the create and configure screens) every amount stays in base. */
const RowViewTableContext = React.createContext<string | null>(null);

export function RowViewTable({ tableKey, children }: { tableKey: string | null; children: React.ReactNode }) {
  return <RowViewTableContext.Provider value={tableKey}>{children}</RowViewTableContext.Provider>;
}

/** A money column's view in the table it is in, and its setter. Null when the
 *  table does not offer the choice. */
export function useColumnView(column: string): [RowView, (view: RowView) => void] | null {
  const table = React.useContext(RowViewTableContext);
  const key = table ? `${table}:${column}` : null;
  const read = () => (key ? views.get(key) ?? 'base' : 'base');
  const view = useSyncExternalStore(subscribe, read, read);
  const set = React.useCallback((v: RowView) => {
    if (key) setRowView(key, v);
  }, [key]);
  return key ? [view, set] : null;
}

const RowViewContext = React.createContext<RowView>('base');

/** Scopes a money column's cell (or a card's figure) to that column's view. */
export function ColumnView({ column, children }: { column: string; children: React.ReactNode }) {
  const state = useColumnView(column);
  return <RowViewContext.Provider value={state ? state[0] : 'base'}>{children}</RowViewContext.Provider>;
}

/** The view of the column this cell is in. Base outside one. */
export const useRowView = () => React.useContext(RowViewContext);

/**
 * The header menu's "Show values as" section, as the Partners listing draws
 * it (vendors/ColumnHeaderMenu): a divider, the muted uppercase label, then
 * Base currency (Landmark) and "<Party> currency" (Handshake), the active one
 * with a blue dot. Sits between Sort and Hide.
 */
export function ShowValuesAs({
  view,
  onChange,
  rowLabel,
  divider = true,
}: {
  view: RowView;
  onChange: (view: RowView) => void;
  /** "Vendor currency", "Customer currency". */
  rowLabel: string;
  /** The divider above it; off when nothing (Filter, Sort) comes before it in the menu. */
  divider?: boolean;
}) {
  return (
    <>
      {divider && <div className="border-t border-border/60 my-1" />}
      <div
        className="px-2.5 pt-1 pb-0.5 text-[10.5px] text-muted-foreground/70 uppercase tracking-wider"
        style={{ fontWeight: 600, letterSpacing: '0.04em' }}
      >
        Show values as
      </div>
      {([
        ['base', 'Base currency', Landmark],
        ['row', rowLabel, Handshake],
      ] as const).map(([value, text, Icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
            view === value ? 'text-primary bg-primary/5' : 'text-foreground'
          }`}
        >
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span style={{ fontWeight: 400 }}>{text}</span>
          {view === value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      ))}
    </>
  );
}

/**
 * An amount kept in `currency`, in its column's view: in base (BaseMoney, the
 * row's own amount on hover) or in its own currency (Money, the base figure
 * on hover). Without a rate it stays in its own currency either way.
 */
export function RowMoney({
  value,
  currency,
  fx,
  className,
  dateLabel,
  role,
  note,
}: {
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  className?: string;
  dateLabel?: string;
  role?: string;
  /** A last line on the hover (MoneyCard). */
  note?: React.ReactNode;
}) {
  const view = useRowView();
  return view === 'row' ? (
    <Money value={value} currency={currency} fx={fx} className={className} dateLabel={dateLabel} role={role} note={note} />
  ) : (
    <BaseMoney value={value} currency={currency} fx={fx} className={className} dateLabel={dateLabel} role={role} note={note} />
  );
}
