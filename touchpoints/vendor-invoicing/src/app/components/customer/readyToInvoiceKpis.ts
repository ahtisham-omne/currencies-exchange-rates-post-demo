import type { ReadyRow } from '@/app/data/ar/arBilling';

// KPI catalogue for the Customer Invoices "Ready to Invoice" tab: the AR
// fork of the vendor `data/readyKpis.ts` (Invoices to pay). Same shape
// (key/label/category/icon/tooltip) so the forked customize drawer and
// the shared DraggableKpiCard render it unchanged. Computed on the
// waiting rows for the selected date range; point-in-time, no delta.
export interface ReadyInvoiceKpiDefinition {
  key: string;
  label: string;
  category: string;
  iconName: string; // must be a CustomerKpiIcon-supported name
  iconBg: string;
  iconColor: string;
  tooltip: string;
}

const blue = { bg: 'hsl(var(--accent))', color: 'hsl(var(--primary))' };

export const ALL_READY_INVOICE_KPI_DEFINITIONS: ReadyInvoiceKpiDefinition[] = [
  {
    key: 'value_waiting', label: 'Value Not Billed', category: 'Billing',
    iconName: 'Coins', iconBg: blue.bg, iconColor: blue.color,
    tooltip: 'Shipped goods and advance stages that are due but not on an invoice yet.',
  },
  {
    key: 'shipments_waiting', label: 'Shipments Waiting', category: 'Billing',
    iconName: 'Truck', iconBg: blue.bg, iconColor: blue.color,
    tooltip: 'Shipments with at least one line that has not been billed.',
  },
  {
    key: 'stages_due', label: 'Advance Stages Due', category: 'Billing',
    iconName: 'Milestone', iconBg: '#F5F3FF', iconColor: '#6D28D9',
    tooltip: 'Advance stages whose event has happened and that no advance invoice bills yet.',
  },
  {
    key: 'oldest_waiting', label: 'Oldest Waiting', category: 'Timing & Risk',
    iconName: 'Hourglass', iconBg: '#FFFBEB', iconColor: '#B45309',
    tooltip: 'The row that has waited longest since its ship date or stage date.',
  },
  {
    key: 'over_30', label: 'Waiting Over 30 Days', category: 'Timing & Risk',
    iconName: 'AlarmClock', iconBg: '#FFF1F2', iconColor: '#E11D48',
    tooltip: 'Rows that have waited more than 30 days to be billed.',
  },
  {
    key: 'largest_waiting', label: 'Largest Waiting', category: 'Billing',
    iconName: 'ArrowUpNarrowWide', iconBg: '#EFF6FF', iconColor: '#2563EB',
    tooltip: 'The single row with the most value not billed.',
  },
  {
    key: 'customers_waiting', label: 'Customers Waiting', category: 'Customers',
    iconName: 'Users', iconBg: blue.bg, iconColor: blue.color,
    tooltip: 'Customers with at least one shipment or advance stage to bill.',
  },
  {
    key: 'selected', label: 'Selected', category: 'Selection',
    iconName: 'SquareCheck', iconBg: blue.bg, iconColor: blue.color,
    tooltip: 'Rows ticked in the table below and the value they carry.',
  },
];

export const DEFAULT_READY_INVOICE_KPI_KEYS = ['value_waiting', 'shipments_waiting', 'stages_due', 'oldest_waiting', 'over_30'];

export interface ReadyInvoiceKpiContext {
  selectedCount: number;
  selectedValue: number;
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const readySourceLabel = (r: ReadyRow) =>
  r.kind === 'stage'
    ? `SO ${r.soNumber} Stage ${r.stage?.stage.index ?? ''}`.trim()
    : `SHP ${(r.shipmentNumber ?? '').replace(/^SHP\s*/i, '')}`;

export function computeReadyInvoiceKpi(
  key: string,
  rows: ReadyRow[],
  ctx: ReadyInvoiceKpiContext,
): { value: string; sub: string } {
  const sum = (list: ReadyRow[]) => list.reduce((s, r) => s + r.valueNotBilled, 0);
  switch (key) {
    case 'value_waiting':
      return { value: money(sum(rows)), sub: `${rows.length} row${rows.length === 1 ? '' : 's'} waiting` };
    case 'shipments_waiting': {
      const list = rows.filter((r) => r.kind === 'shipment');
      return { value: String(list.length), sub: `${money(sum(list))} not billed` };
    }
    case 'stages_due': {
      const list = rows.filter((r) => r.kind === 'stage');
      return { value: String(list.length), sub: `${money(sum(list))} due` };
    }
    case 'oldest_waiting': {
      if (rows.length === 0) return { value: '0 days', sub: 'Nothing waiting' };
      const top = rows.reduce((a, b) => (b.waitingDays > a.waitingDays ? b : a));
      return { value: `${top.waitingDays} day${top.waitingDays === 1 ? '' : 's'}`, sub: `${readySourceLabel(top)} · ${top.customer}` };
    }
    case 'over_30': {
      const list = rows.filter((r) => r.waitingDays > 30);
      return { value: String(list.length), sub: `${money(sum(list))} waiting` };
    }
    case 'largest_waiting': {
      if (rows.length === 0) return { value: '$0.00', sub: 'Nothing waiting' };
      const top = rows.reduce((a, b) => (b.valueNotBilled > a.valueNotBilled ? b : a));
      return { value: money(top.valueNotBilled), sub: `${readySourceLabel(top)} · ${top.customer}` };
    }
    case 'customers_waiting': {
      const set = new Set(rows.map((r) => r.customer));
      return { value: String(set.size), sub: `${rows.length} row${rows.length === 1 ? '' : 's'} to bill` };
    }
    case 'selected':
      return { value: String(ctx.selectedCount), sub: `${money(ctx.selectedValue)} selected` };
    default:
      return { value: '0', sub: '' };
  }
}
