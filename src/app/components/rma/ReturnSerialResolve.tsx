/**
 * A serialized part, asked the same two questions in the same two sections as
 * a counted one -- and answered by a single modal.
 *
 * The questions do not change with how a part is tracked: who takes it back,
 * and what the credit reverses. What changes is who answers them. A counted
 * part has no provenance, so a person decides; a serialized one carries its
 * own, so naming the units decides both at once. Building that as a different
 * shape of card said the step was doing something different here, when it is
 * doing the same thing from better evidence.
 *
 * So the layout is the counted one with its controls taken out: the vendors
 * are rows, read rather than chosen, and the deliveries are rows, read rather
 * than picked. One button opens the unit picker, and everything on both sides
 * follows from what comes back out of it.
 */

import { Building2, FileText, ScanLine } from 'lucide-react';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { ResolveSection, SectionAction } from '@/app/components/rma/ReturnResolvePane';
import type { SerialOrigin } from '@/app/data/rmaVendorResolution';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReturnSerialResolve({
  sku,
  uom,
  qty,
  unitPrice,
  origins,
  onPickUnits,
}: {
  sku: string;
  uom: string;
  /** How much of it is going back, from the first step. */
  qty: number;
  unitPrice: number;
  /** One row per named unit, in the order they were named. */
  origins: SerialOrigin[];
  onPickUnits: () => void;
}) {
  const short = Math.round((qty - origins.length) * 100) / 100;
  const answered = origins.length > 0;

  const byVendor = new Map<string, { vendorName: string; units: SerialOrigin[] }>();
  origins.forEach((o) => {
    const entry = byVendor.get(o.vendorCode) ?? { vendorName: o.vendorName, units: [] };
    entry.units.push(o);
    byVendor.set(o.vendorCode, entry);
  });
  const vendors = [...byVendor.entries()];

  return (
    <>
      {/* ── who takes it, read off the units ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <ResolveSection
          icon={Building2}
          title="Goes back to"
          subtitle="A serial names its own source, so this is read rather than chosen."
          figure={formatQty(origins.length)}
          unit={`of ${formatQty(qty)} ${uom}`}
          money={money(qty * unitPrice)}
          tone={short === 0 && answered ? 'done' : 'todo'}
          hint={
            !answered
              ? undefined
              : short > 0
                ? `${formatQty(short)} ${uom} still to name.`
                : short < 0
                  ? `${formatQty(-short)} ${uom} more named than is going back.`
                  : 'All of it placed.'
          }
          actions={
            answered ? (
              <SectionAction onClick={onPickUnits} ariaLabel={`Change the units of ${sku} going back`}>
                <span className="inline-flex items-center gap-1">
                  <ScanLine className="w-3 h-3" />
                  Change units
                </span>
              </SectionAction>
            ) : undefined
          }
        >
          {!answered ? (
            <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
              <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3 py-1.5">
                <span className="text-[17px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                  {formatQty(qty)}
                </span>
                <span className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>{uom}</span>
                <span className="text-[12px] text-slate-500">of {sku} going back</span>
              </span>
              <div>
                <p className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
                  Which units are going back?
                </p>
                <p className="mx-auto mt-1 max-w-[44ch] text-[12px] leading-snug text-slate-500">
                  Each serial was on a receiver and each receiver was against an order, so naming
                  the units settles the vendor and the delivery with them.
                </p>
              </div>
              <button
                type="button"
                onClick={onPickUnits}
                aria-label={`Choose the units of ${sku} going back`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] text-white shadow-sm transition-colors hover:bg-blue-700"
                style={{ fontWeight: 600 }}
              >
                <ScanLine className="w-3.5 h-3.5" />
                Choose units
              </button>
            </div>
          ) : (
            <div>
              <div className="border-b border-[#EEF2F6] px-4 py-2">
                <p className="flex items-baseline gap-1.5 text-[11px] text-slate-500">
                  <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                    {formatQty(qty)}
                  </span>
                  <span className="text-[11px] text-slate-600" style={{ fontWeight: 600 }}>{uom}</span>
                  <span>going back, named unit by unit</span>
                </p>
              </div>
              <div className="divide-y divide-[#EEF2F6]">
                {vendors.map(([vendorCode, group]) => (
                  <div key={vendorCode} className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {group.vendorName}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          Read off their units, not chosen
                        </p>
                      </div>
                      {/* Where a counted row takes a figure, this states one:
                          a number here with no serials behind it would be a
                          return the warehouse cannot pick. */}
                      <span
                        className="shrink-0 whitespace-nowrap text-[13px] text-foreground tabular-nums"
                        style={{ fontWeight: 600 }}
                      >
                        {formatQty(group.units.length)}{' '}
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                          {uom}
                        </span>
                      </span>
                    </div>
                    <p className="flex flex-wrap gap-1 pl-[38px] pt-1.5">
                      {group.units.map((u) => (
                        <span
                          key={u.serial}
                          className="inline-flex h-[18px] items-center rounded border border-[#E2E8F0] bg-[#FAFBFC] px-1.5 text-[10px] text-slate-600 tabular-nums"
                          style={{ fontWeight: 500 }}
                        >
                          {u.serial}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResolveSection>
      </div>

      {/* ── what that turns out to unwind ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <ResolveSection
          icon={FileText}
          title="What the credit unwinds"
          subtitle="The deliveries those units came in on."
          figure={formatQty(origins.length)}
          unit={`of ${formatQty(qty)} ${uom} tied`}
          tone={short === 0 && answered ? 'done' : 'todo'}
          hint={answered ? 'Nothing to choose: the serial carries the document.' : undefined}
        >
          {!answered ? (
            <p className="px-4 py-8 text-center text-[12px] text-slate-400">
              Name the units and the deliveries they came in on fill themselves in.
            </p>
          ) : (
            <div className="divide-y divide-[#EEF2F6]">
              {vendors.map(([vendorCode, group]) => {
                const byGrn = new Map<string, { poNumber: string; date: string; n: number }>();
                group.units.forEach((u) => {
                  const on = byGrn.get(u.grnNumber) ?? { poNumber: u.poNumber, date: u.date ?? '', n: 0 };
                  on.n += 1;
                  byGrn.set(u.grnNumber, on);
                });
                return (
                  <div key={vendorCode} className="py-1">
                    {vendors.length > 1 && (
                      <p
                        className="truncate px-4 pb-1 pt-2 text-[10px] uppercase tracking-wide text-slate-500"
                        style={{ fontWeight: 600 }}
                      >
                        {group.vendorName}
                      </p>
                    )}
                    {vendors.length === 1 && (
                      <p
                        className="px-4 pb-1 pt-2 text-[10px] uppercase tracking-wide text-slate-400"
                        style={{ fontWeight: 600 }}
                      >
                        Receiving documents
                      </p>
                    )}
                    <div className="divide-y divide-[#F5F8FB]">
                      {[...byGrn].map(([grnNumber, on]) => (
                        <div key={grnNumber} className="flex items-center gap-2.5 px-4 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                              {grnNumber}
                            </p>
                            <p className="truncate text-[10px] text-slate-500 tabular-nums">
                              {on.date ? `${on.date} · ` : ''}PO {on.poNumber}
                            </p>
                          </div>
                          <span className="shrink-0 text-right">
                            <span
                              className="block whitespace-nowrap text-[12px] text-foreground tabular-nums"
                              style={{ fontWeight: 600 }}
                            >
                              {formatQty(on.n)} {uom}
                            </span>
                            <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                              off this delivery
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ResolveSection>
      </div>
    </>
  );
}
