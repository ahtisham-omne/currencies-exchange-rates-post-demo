/**
 * Step 2, first question: who does this go back to.
 *
 * Two kinds of line arrive here and they are not asked the same thing.
 *
 * A line whose units were named is already answered -- the serials carry their
 * receiver, the receiver names the vendor -- so it is stated and locked. There
 * is no control on it, because there is no decision left to make and offering
 * one would only be an invitation to contradict the paperwork.
 *
 * A line of plain stock has no such thread, so it asks. The ask is bounded: it
 * lists only vendors that shipped the part, each with the most they can take
 * back, and it says plainly when the quantity has outrun them.
 *
 * The card only ever opens what is unfinished. A line that is locked, or one
 * that already balances, folds to a single row -- the invoicing workspace's
 * habit of keeping a decided thing to one compact strip and putting the detail
 * a click away, rather than laying every branch out at once.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Check, ChevronDown, ChevronRight, Lock, Search } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/components/VendorSelectionItemCell';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { mockVendors } from '@/app/data/mockVendors';
import type { VendorSupply } from '@/app/data/itemProvenance';
import type { VendorSlice } from '@/app/data/rmaVendorResolution';

/** One line's vendor question, already decided or still open. */
export interface ResolutionLine {
  key: string;
  sku: string;
  description: string;
  uom: string;
  qty: number;
  /** Named units resolve themselves; plain stock does not. */
  locked: boolean;
  /** Why it is locked, because the two reasons are not the same claim.
   *  `units` read the answer off the serials the user picked. `sole-source`
   *  did not read anything: one vendor sells the part, so there is nowhere
   *  else it could have come from. Saying the first when it was the second
   *  credits the return to paperwork that was never consulted. */
  lockedBy?: 'units' | 'sole-source';
  /** Where the units actually came from. Present on a locked line. */
  resolved: VendorSlice[];
  /** Who could take it back, with each one's ceiling. Present on an open line. */
  options: VendorSupply[];
  /** No receiver stands behind this stock, so nobody shipped it and the vendor
   *  is not bounded by anything. Any partner can take it back, and until one is
   *  named the line has no vendor at all rather than a choice between several. */
  unsourced?: boolean;
}

/** Two names and a count. A dozen receiver numbers on one line is noise the
 *  user cannot read anyway, and the detail lives on the record. */
function trail(prefix: string, values: string[]): string {
  const head = values.slice(0, 2).join(', ');
  const rest = values.length - 2;
  const body = rest > 0 ? `${head} +${rest}` : head;
  return prefix ? `${prefix} ${body}` : body;
}

/** How many vendors are listed before the rest go behind a control. */
const SHOWN = 3;

function VendorAvatar({ name, size = 'w-6 h-6' }: { name: string; size?: string }) {
  const vendor = mockVendors.find((v) => v.vendorName === name);
  return (
    <span className={`${size} rounded-md overflow-hidden bg-white border border-[#E8ECF1] flex items-center justify-center shrink-0`}>
      {vendor?.imageUrl ? (
        <ImageWithFallback src={vendor.imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <Building2 className="w-3 h-3 text-slate-400" />
      )}
    </span>
  );
}

export function VendorResolutionCard({
  lines,
  allocations,
  onAllocate,
}: {
  lines: ResolutionLine[];
  /** line key → vendor code → how much goes back to them. */
  allocations: Record<string, Record<string, number>>;
  onAllocate: (lineKey: string, vendorCode: string, qty: number) => void;
}) {
  if (lines.length === 0) return null;

  const outstanding = lines.filter((line) => {
    if (line.locked) return false;
    const given = allocations[line.key] ?? {};
    const placed = Object.values(given).reduce((n, q) => n + q, 0);
    return placed < line.qty;
  }).length;

  return (
    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="px-4 py-3 border-b border-[#EEF2F6] flex items-center gap-2.5">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border ${
            outstanding === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-[#DBEAFE] border-blue-200 text-primary'
          }`}
        >
          {outstanding === 0 ? <Check className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            Who this goes back to
          </p>
          <p className="text-[11px] text-slate-500 mt-px leading-snug">
            {outstanding === 0
              ? 'Every line has a vendor. Open one to change it.'
              : `${outstanding} ${outstanding === 1 ? 'line needs' : 'lines need'} a vendor naming. The rest trace on their own.`}
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#EEF2F6]">
        {lines.map((line) => (
          <LineResolution
            key={line.key}
            line={line}
            allocation={allocations[line.key] ?? {}}
            onAllocate={(vendorCode, qty) => onAllocate(line.key, vendorCode, qty)}
          />
        ))}
      </div>
    </div>
  );
}

function LineResolution({
  line,
  allocation,
  onAllocate,
}: {
  line: ResolutionLine;
  allocation: Record<string, number>;
  onAllocate: (vendorCode: string, qty: number) => void;
}) {
  const placed = Object.values(allocation).reduce((n, q) => n + q, 0);
  const short = Math.max(0, line.qty - placed);
  const settled = line.locked || short === 0;

  // Only what is unfinished is open. Answering a line folds it away on its
  // own, so the card shrinks as the step is worked rather than staying at
  // full height until the end.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? !settled;
  useEffect(() => {
    // A line that balances closes itself, unless the user has taken the
    // panel over by hand.
    if (settled && manual === null) setManual(null);
  }, [settled, manual]);

  const chosen = line.locked
    ? line.resolved
    : line.options
        .filter((o) => (allocation[o.vendorCode] ?? 0) > 0)
        .map((o) => ({
          vendorCode: o.vendorCode,
          vendorName: o.vendorName,
          qty: allocation[o.vendorCode] ?? 0,
          grnNumbers: o.receivings,
          poNumbers: o.poNumbers,
        }));

  return (
    <div>
      {/* One strip per line: what it is, how it stands, and a disclosure.
          Inline and compact, the way the invoicing workspace keeps a decided
          vendor to a single row. */}
      <button
        type="button"
        onClick={() => setManual(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#F7FAFF] transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
        <span className="w-8 h-8 rounded-md overflow-hidden border border-[#E8ECF1] bg-white shrink-0">
          <ImageWithFallback src={imageForSku(line.sku)} alt={line.sku} className="w-full h-full object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>
              {line.sku}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
              {formatQty(line.qty)} {line.uom}
            </span>
          </span>
          <StatusLine line={line} chosen={chosen} short={short} />
        </span>
        {/* The avatars carry the answer at a glance, so a closed row still
            says who it settles with. */}
        {chosen.length > 0 && (
          <span className="flex items-center -space-x-1.5 shrink-0">
            {chosen.slice(0, 4).map((slice) => (
              <VendorAvatar key={slice.vendorCode} name={slice.vendorName} />
            ))}
            {chosen.length > 4 && (
              <span className="w-6 h-6 rounded-md bg-slate-100 border border-[#E8ECF1] flex items-center justify-center text-[10px] text-slate-500 tabular-nums" style={{ fontWeight: 600 }}>
                +{chosen.length - 4}
              </span>
            )}
          </span>
        )}
        {line.locked && <Lock className="w-3 h-3 text-emerald-600 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-3.5 pl-[62px]">
          {line.locked ? (
            <LockedDetail line={line} />
          ) : (
            <OpenDetail line={line} allocation={allocation} onAllocate={onAllocate} short={short} placed={placed} />
          )}
        </div>
      )}
    </div>
  );
}

/** The one line of state under the part number. It says where the line stands
 *  without the panel having to be open. */
function StatusLine({
  line,
  chosen,
  short,
}: {
  line: ResolutionLine;
  chosen: VendorSlice[];
  short: number;
}) {
  if (line.locked) {
    return (
      <span className="block text-[10px] text-emerald-700 truncate mt-px" style={{ fontWeight: 500 }}>
        {line.lockedBy === 'sole-source'
          ? 'Only one vendor sells this part'
          : 'Resolved from the units you picked'}
        {chosen.length > 1 ? ` · ${chosen.length} vendors` : chosen[0] ? ` · ${chosen[0].vendorName}` : ''}
      </span>
    );
  }
  if (short > 0) {
    return (
      <span className="block text-[10px] text-amber-700 truncate mt-px" style={{ fontWeight: 500 }}>
        {formatQty(short)} {line.uom} still needs a vendor
      </span>
    );
  }
  return (
    <span className="block text-[10px] text-slate-500 truncate mt-px">
      {chosen.length === 1 && chosen[0]
        ? chosen[0].vendorName
        : `Split across ${chosen.length} vendors`}
    </span>
  );
}

function LockedDetail({ line }: { line: ResolutionLine }) {
  const [all, setAll] = useState(false);
  const shown = all ? line.resolved : line.resolved.slice(0, SHOWN);
  const hidden = line.resolved.length - shown.length;
  const hiddenQty = line.resolved.slice(shown.length).reduce((n, sl) => n + sl.qty, 0);

  return (
    <div className="space-y-1.5">
      {shown.map((slice) => (
        <div
          key={slice.vendorCode}
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5"
        >
          <VendorAvatar name={slice.vendorName} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>
              {slice.vendorName}
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-px">
              {trail('PO', slice.poNumbers)} · {trail('', slice.grnNumbers)}
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-emerald-800 tabular-nums" style={{ fontWeight: 600 }}>
            {formatQty(slice.qty)} {line.uom}
          </span>
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="text-[11px] text-primary hover:underline"
          style={{ fontWeight: 600 }}
        >
          Show {hidden} more {hidden === 1 ? 'vendor' : 'vendors'} · {formatQty(hiddenQty)} {line.uom}
        </button>
      )}
      <p className="text-[10px] text-slate-500">
        A named unit goes back where it came from, so there is nothing to choose here.
      </p>
    </div>
  );
}

function OpenDetail({
  line,
  allocation,
  onAllocate,
  short,
  placed,
}: {
  line: ResolutionLine;
  allocation: Record<string, number>;
  onAllocate: (vendorCode: string, qty: number) => void;
  short: number;
  placed: number;
}) {
  const [query, setQuery] = useState('');
  // Rank so the three rows on screen are the three most likely to be the
  // answer. A vendor with the headroom to absorb the whole line settles it in
  // one move; among those, the latest delivery is where the goods on the shelf
  // almost certainly came from. Everyone else is reachable, not listed.
  const ranked = useMemo(
    () =>
      [...line.options].sort((a, b) => {
        const coversA = a.returnableQty >= line.qty ? 1 : 0;
        const coversB = b.returnableQty >= line.qty ? 1 : 0;
        if (coversA !== coversB) return coversB - coversA;
        return (b.lastReceivedDate ?? '').localeCompare(a.lastReceivedDate ?? '');
      }),
    [line.options, line.qty],
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? ranked.filter(
        (o) =>
          o.vendorName.toLowerCase().includes(q) ||
          o.poNumbers.some((po) => po.toLowerCase().includes(q)) ||
          o.receivings.some((grn) => grn.toLowerCase().includes(q)),
      )
    : ranked;

  // Whoever already has units keeps their row visible however the list is
  // trimmed, or trimming it would hide an answer the user gave.
  const picked = matches.filter((o) => (allocation[o.vendorCode] ?? 0) > 0);
  const rest = matches.filter((o) => (allocation[o.vendorCode] ?? 0) <= 0);
  // A search is a request to see what was found, so it lifts the trim.
  const shown = q ? [...picked, ...rest] : [...picked, ...rest.slice(0, Math.max(0, SHOWN - picked.length))];
  const hidden = matches.length - shown.length;
  const searchable = line.options.length > SHOWN + 1;

  const headroom = rest.reduce((n, o) => n + o.returnableQty, 0);
  const impossible = short > 0 && headroom <= 0;

  return (
    <div>
      {/* Seven vendors shipped a commodity part and forty could. A list that
          long is a directory, not a decision, so only the likely few are laid
          out and the rest answer to a name or a document number. */}
      {searchable && (
        <div className="relative mb-1.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search all ${line.options.length} vendors who shipped this part`}
            aria-label={`Search vendors who shipped ${line.sku}`}
            className="h-8 pl-8 text-[12px]"
          />
        </div>
      )}
      <div className="rounded-lg border border-[#E6E9F0] overflow-hidden divide-y divide-[#EEF2F6]">
        {shown.map((option) => {
          const given = allocation[option.vendorCode] ?? 0;
          const over = given > option.returnableQty;
          return (
            <div key={option.vendorCode} className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white">
              <VendorAvatar name={option.vendorName} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>
                  {option.vendorName}
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-px">{trail('PO', option.poNumbers)}</p>
              </div>
              {/* The whole line in one click, on the vendors that can take it.
                  It is offered rather than filled in: plain stock carries no
                  thread back to a receiver, so the answer is the user's. */}
              {given === 0 && option.returnableQty >= line.qty && (
                <button
                  type="button"
                  onClick={() => onAllocate(option.vendorCode, line.qty)}
                  aria-label={`Return all ${formatQty(line.qty)} ${line.uom} to ${option.vendorName}`}
                  className="shrink-0 text-[10px] text-primary hover:underline whitespace-nowrap"
                  style={{ fontWeight: 600 }}
                >
                  All {formatQty(line.qty)}
                </button>
              )}
              {/* The ceiling sits against the field rather than in a tooltip:
                  it is the number that decides whether what is being typed is
                  possible at all. */}
              <span className="shrink-0 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                max {formatQty(option.returnableQty)}
              </span>
              <Input
                type="number"
                min={0}
                max={option.returnableQty}
                value={given === 0 ? '' : String(given)}
                placeholder="0"
                onChange={(e) => {
                  const next = e.target.value === '' ? 0 : Number(e.target.value);
                  onAllocate(option.vendorCode, Number.isFinite(next) ? Math.max(0, next) : 0);
                }}
                aria-label={`Quantity returning to ${option.vendorName}`}
                className={`w-[70px] h-8 text-[12px] text-right tabular-nums shrink-0 ${
                  over ? 'border-red-400 focus-visible:ring-red-200' : ''
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2">
        {hidden > 0 && (
          <p className="text-[11px] text-slate-500 shrink-0">
            {hidden} more shipped this part · search to reach them
          </p>
        )}
        {q && matches.length === 0 && (
          <p className="text-[11px] text-slate-500 shrink-0">
            No vendor matching “{query}” shipped this part.
          </p>
        )}
        {/* Silence when it balances -- there is nothing to say about a return
            that adds up. */}
        {short > 0 && (
          <p
            className={`flex items-start gap-1.5 text-[11px] leading-snug min-w-0 ${
              impossible ? 'text-red-700' : 'text-amber-700'
            }`}
            style={{ fontWeight: 500 }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            {impossible ? (
              <span>
                No vendor left can take the remaining {formatQty(short)} {line.uom}. Lower the line,
                or return the balance without a receiver.
              </span>
            ) : (
              <span>
                {formatQty(short)} {line.uom} still to place. Pick another vendor for the balance.
              </span>
            )}
          </p>
        )}
        {short === 0 && placed > line.qty && (
          <p className="text-[11px] text-red-700" style={{ fontWeight: 500 }}>
            That is {formatQty(placed - line.qty)} {line.uom} more than the line is returning.
          </p>
        )}
      </div>
    </div>
  );
}
