/**
 * What a stated figure is made of, opened from a small (i) beside it.
 *
 * Ported from physical inventory: the item's Dashboard tab states a figure
 * plainly and puts the explanation behind an info icon rather than making the
 * figure itself an underlined hover target. The popup is the design system's
 * `DetailRichTooltip` (packages/design-system/src/components/Widgets), drawn
 * here class for class against this repo's palette: a titled header tile, a
 * sentence of description, the numbers line by line with the answer
 * highlighted, and the formula underneath.
 *
 * Their Available subtracts allocated and quarantined stock, because neither
 * can be allocated. A return is not an allocation: quarantined and checked-out
 * units can go back, and often that is why they are going back. So here they
 * are listed inside the figure rather than taken off it, and the formula says
 * what is actually computed.
 */

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { type ItemStock, type StockSplit } from '@/app/data/itemProvenance';

export interface AvailableInfoRow {
  label: string;
  value: string;
  /** The answer the rest of the rows add up to. */
  isResult?: boolean;
}

/** The popup itself, for a figure that is not a stock split. */
/** The pie colours physical inventory's On-Hand by UOM widget uses -- brand,
 *  violet, emerald, then a muted grey -- so a part held in three units reads
 *  the same here as it does there. */
const UNIT_COLORS = ['#0A77FF', '#8B5CF6', '#059669', '#94A3B8', '#F59E0B'];

/** The widget's donut, drawn as one SVG rather than pulled in with a chart
 *  library: the whole of the part's stock as a ring, each unit an arc of it,
 *  and the total in the middle. A list of three numbers says what is held; the
 *  ring says which of them is most of it. */
function UnitDonut({ slices, total }: { slices: { uom: string; qty: number }[]; total: number }) {
  const size = 88;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F6" strokeWidth={stroke} />
        {slices.map((sl, i) => {
          const share = total > 0 ? sl.qty / total : 0;
          const len = Math.max(0, share * circumference - 2);
          const dash = `${len} ${circumference - len}`;
          const rotation = (offset / circumference) * 360 - 90;
          offset += share * circumference;
          return (
            <circle
              key={sl.uom}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={UNIT_COLORS[i % UNIT_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeLinecap="butt"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      {/* The widget puts a total in the middle of its ring. Ours cannot: a
          box and a pallet are different shelves, and adding them gives a
          number that is true of nothing. So the middle says how many shelves
          there are, and the ring says how the stock sits across them. */}
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
          {slices.length}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>
          {slices.length === 1 ? 'unit' : 'units'}
        </span>
      </span>
    </span>
  );
}

export function FigureInfo({
  title,
  description,
  rows,
  formula,
  label,
  units,
  unitFor,
}: {
  title: string;
  description: string;
  rows: AvailableInfoRow[];
  formula: string;
  /** What the trigger announces, when the title alone would not say it. */
  label?: string;
  /** Every unit the part is held in. The figure above is about one of them,
   *  and a part held in boxes as well as eaches was saying nothing about the
   *  boxes. */
  units?: ItemStock[] | undefined;
  /** The unit this figure is written in, marked in the list. */
  unitFor?: string | undefined;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label ?? `More about ${title.toLowerCase()}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 cursor-help border-0 bg-transparent p-0 text-slate-300 outline-none transition-colors hover:text-slate-500"
        >
          <Info className="w-[11px] h-[11px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={8}
        className="w-[300px] max-w-[90vw] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex w-5 h-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Info className="w-[11px] h-[11px]" />
            </span>
            <span
              className="text-[10px] uppercase tracking-wider text-foreground"
              style={{ fontWeight: 700 }}
            >
              {title}
            </span>
          </div>

          <p className="m-0 mb-3 text-[11px] leading-relaxed text-slate-600">{description}</p>

          <div className="mb-2.5 border-t border-[#EEF2F6]" />

          <div className="space-y-1">
            {rows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] ${
                  r.isResult ? 'border border-emerald-200 bg-emerald-50' : ''
                }`}
              >
                <span
                  className={r.isResult ? 'text-foreground' : 'text-slate-500'}
                  style={{ fontWeight: r.isResult ? 600 : 400 }}
                >
                  {r.label}
                </span>
                <span
                  className={`tabular-nums ${r.isResult ? 'text-emerald-700' : 'text-foreground'}`}
                  style={{ fontWeight: r.isResult ? 700 : 500 }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* What the part is held in, unit by unit.
              
              Ported from the item dashboard's On-Hand by UOM legend: a dot per
              unit, the unit, and what is available in it. The figure above is
              about one shelf, and a part held in boxes as well as eaches was
              saying nothing about the boxes. */}
          {units && units.length > 1 && (() => {
            const slices = units.map((u) => ({ uom: u.uom, qty: u.split?.available ?? u.qty }));
            const total = Math.round(slices.reduce((n, sl) => n + sl.qty, 0) * 100) / 100;
            return (
              <>
                <div className="my-2.5 border-t border-[#EEF2F6]" />
                <p
                  className="mb-2 text-[10px] uppercase tracking-wider text-slate-400"
                  style={{ fontWeight: 600 }}
                >
                  Available by unit
                </p>
                <div className="flex items-center gap-3">
                  <UnitDonut slices={slices} total={total} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {slices.map((sl, i) => {
                      const share = total > 0 ? Math.round((sl.qty / total) * 100) : 0;
                      return (
                        <div key={sl.uom} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="w-2 h-2 shrink-0 rounded-full"
                              style={{ background: UNIT_COLORS[i % UNIT_COLORS.length] }}
                            />
                            <span
                              className={`truncate text-[11px] ${
                                sl.uom === unitFor ? 'text-foreground' : 'text-slate-500'
                              }`}
                              style={{ fontWeight: sl.uom === unitFor ? 600 : 500 }}
                            >
                              {sl.uom}
                              {sl.uom === unitFor && (
                                <span className="ml-1 text-[10px] text-primary" style={{ fontWeight: 600 }}>
                                  on this line
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                            {formatQty(sl.qty)}
                            <span className="ml-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                              {share}%
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          <div className="my-2.5 border-t border-[#EEF2F6]" />

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5">
            <code className="font-mono text-[10px] text-primary" style={{ fontWeight: 500 }}>
              {formula}
            </code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** The stock-split version, which is the one most figures in this flow need. */
export function AvailableInfo({
  split,
  uom,
  title = 'Available to return',
  scope,
  units,
}: {
  split: StockSplit;
  uom: string;
  /** Overridden where the figure is about one batch rather than the part. */
  title?: string;
  /** What the figure is counted over, named in the description. */
  scope?: string;
  /** Every unit the part is held in, listed under the arithmetic. */
  units?: ItemStock[] | undefined;
}) {
  const rows: AvailableInfoRow[] = [
    { label: 'On hand', value: `${formatQty(split.onHand)} ${uom}` },
    {
      label: 'Allocated',
      value: `${split.allocated > 0 ? `- ${formatQty(split.allocated)}` : '0'} ${uom}`,
    },
  ];
  if (split.quarantined > 0)
    rows.push({
      label: 'Quarantined, still returnable',
      value: `${formatQty(split.quarantined)} ${uom}`,
    });
  if (split.checkedOut > 0)
    rows.push({
      label: 'Checked out, still returnable',
      value: `${formatQty(split.checkedOut)} ${uom}`,
    });
  if (split.receivedFromVendor !== undefined)
    rows.push({
      label: 'Received from this vendor, the cap',
      value: `${formatQty(split.receivedFromVendor)} ${uom}`,
    });
  rows.push({ label: title, value: `${formatQty(split.available)} ${uom}`, isResult: true });

  return (
    <FigureInfo
      title={title}
      description={`Units that aren’t allocated can be returned${scope ? ` ${scope}` : ''}, including quarantined and checked-out units. Allocated stock is tied to a job or sales order so it is not available for return.`}
      rows={rows}
      formula={
        split.receivedFromVendor !== undefined
          ? 'Available = the lower of (On hand - Allocated) and what this vendor delivered'
          : 'Available = On hand - Allocated'
      }
      {...(units ? { units } : {})}
      unitFor={uom}
    />
  );
}
