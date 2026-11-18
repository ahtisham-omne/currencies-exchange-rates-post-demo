/**
 * Serial unit picker — the Inventory Movement "Select Serial Units to Pick"
 * design, retargeted at a return. It picks units for the one line it was
 * opened on: the caller already sits on that line, so a rail of the other
 * serialized lines would only repeat what the screen behind it shows.
 *
 * It also knows how many it is looking for. The first step took a count and
 * this step names the units behind it, which is the only reason the two are
 * separate: a hundred serials scrolling past is exactly where a miscount
 * happens, and the count is the thing that catches it. Confirming a different
 * number is still allowed, but as its own act with its own button, not by
 * quietly rewriting the figure to agree with whatever was ticked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, Info, LayoutList, Lock, MapPin, Maximize2, Minus, Package, ScanLine, Search, X } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { TruncatedSerial } from '@/app/components/TruncatedSerial';
import { availableSerials, binForUnit } from '@/app/data/mockRMAs';
import { vendorAddress } from '@/app/data/mockVendors';
import { STOCK_STATE_LABEL, unitStatesFor, type StockState } from '@/app/data/itemProvenance';

export interface SerialSelectionLine {
  id: string;
  sku: string;
  description?: string;
  image?: string;
  receivedQty: number;
  uom?: string;
  /** The units this line could return. Supplied when the pool can't be derived
   *  from the SKU and line id — a saved RMA line carries serials that were
   *  recorded against the create screen's row key, not this one. */
  serialPool?: string[];
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="bg-[#FEF08A] text-foreground rounded-sm px-0.5" style={{ fontWeight: 600 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  );
}

function LineThumbnail({ src, size = 40 }: { src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="rounded-md border border-border bg-slate-50 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <Package className="w-[18px] h-[18px] text-slate-400" />
      </div>
    );
  }
  return (
    <div
      className="rounded-md border border-border bg-slate-50 overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  );
}

/** What the inline grid shows before the rest is scrolling. */
const INLINE_FITS = 24;

export function SerialSelectionModal({
  open,
  onOpenChange,
  lines,
  activeLineId,
  selected,
  target,
  onChange,
  onChangeCount,
  sourceLabel,
  variant = 'dialog',
  vendorOf,
  lockedVendor = null,
  lockedVendorName = null,
  lockedBy = null,
  onExpand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Serialized lines on the return, of which `activeLineId` names the one
   *  being picked for. */
  lines: SerialSelectionLine[];
  /** Line the trigger was clicked on. */
  activeLineId: string | null;
  selected: Record<string, string[]>;
  onChange: (lineId: string, next: string[]) => void;
  /** Receiving document the units were booked in on, shown in the title. */
  sourceLabel?: string;
  /** How many units the first step said were going back. The picker counts
   *  against it rather than replacing it. Absent where there is no count to
   *  answer to, such as a vendor row scoped to its own pool. */
  target?: number | undefined;
  /** Where it is drawn. `inline` is the same picker with its dialog chrome
   *  taken off, rendered in the step's panel: there is room for it there, the
   *  picks already apply as they are made, and a modal in front of a half
   *  empty screen was two clicks around a list that could simply be on it. */
  variant?: 'dialog' | 'inline';
  /** Which vendor each serial in the pool came from. A serial carries its
   *  receipt and a receipt carries its supplier, so this is read rather than
   *  chosen. */
  vendorOf?: (serial: string) => { vendorCode: string; vendorName: string } | null;
  /** The vendor this return is already committed to, from the first serial
   *  picked anywhere on it. Units from anybody else are shown and refused:
   *  one RMA is raised against one vendor and credited by them, so serials
   *  from two suppliers on one document is a mistake rather than a case. */
  lockedVendor?: string | null;
  /** Their name, where the pool alone cannot give it -- a vendor named on
   *  another line has no unit here to read it off. */
  lockedVendorName?: string | null;
  /** How the return came to be with them, as a clause that follows the name:
   *  "chosen on STEEL-001". */
  lockedBy?: string | null;
  /** Take a different number on purpose. Only offered when the picks and the
   *  count disagree, so changing the return is a decision and not a side
   *  effect of miscounting. */
  onChangeCount?: ((next: number) => void) | undefined;
  /** Throw the inline picker full screen. A part with nine hundred units is
   *  a list the panel can hold but not comfortably, so the way out is offered
   *  where the list is rather than being the way in. */
  onExpand?: (() => void) | undefined;
}) {
  const [search, setSearch] = useState('');
  /** Flat, or the same units gathered under the bin they sit in. */
  /** Which location the right pane is showing, or all of them. The rail on
   *  the left is the switch; the old All units / By location toggle said the
   *  same thing with the places hidden behind it. */
  /** Which place the right panel is showing. The source opens on the first
   *  one rather than on the whole pool: a panel headed "from Location" with
   *  every location's units under it is not a location. */
  const [place, setPlace] = useState<string | null>(null);

  // Clearing the query on close keeps a reopened picker showing the whole
  // pool rather than the last item's filter.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines[0];

  const pool = useMemo(
    () =>
      activeLine
        ? activeLine.serialPool ??
          availableSerials(activeLine.sku, activeLine.id, activeLine.receivedQty)
        : [],
    [activeLine],
  );

  const picked = useMemo(
    () => new Set(activeLine ? (selected[activeLine.id] ?? []) : []),
    [activeLine, selected],
  );

  /** Where every unit in the pool stands. Allocated units are committed to a
   *  job or a sales order and cannot go back: the picker shows them, says so,
   *  and refuses them. Quarantined and checked-out units can go back, and are
   *  marked so the person picking knows what they are taking. */
  const unitStates = useMemo(
    () => unitStatesFor(activeLine?.sku ?? '', pool),
    [activeLine?.sku, pool],
  );
  /** One state, or all of them. Somebody clearing a quarantine works that
   *  list and nothing else, and somebody asking why a count is short wants to
   *  see the allocated units themselves rather than a figure about them. */
  const [stateFilter, setStateFilter] = useState<StockState | null>(null);
  const stateOf = (sn: string): StockState => unitStates.get(sn) ?? 'available';
  /** Whose unit this is. */
  const vendorFor = (sn: string) => vendorOf?.(sn) ?? null;
  /** Committed to somebody else. Selecting the first serial fixes the vendor
   *  for the whole return, and everybody else's units go quiet. */
  const otherVendor = (sn: string) => {
    if (!lockedVendor) return false;
    const owner = vendorFor(sn);
    return !!owner && owner.vendorCode !== lockedVendor;
  };
  const blocked = (sn: string) => stateOf(sn) === 'allocated' || otherVendor(sn);

  /** How many units stand in each state, for the filter's own counts. */
  const stateCounts = useMemo(() => {
    const out: Record<StockState, number> = {
      available: 0,
      allocated: 0,
      quarantined: 0,
      'checked-out': 0,
    };
    pool.forEach((sn) => {
      out[unitStates.get(sn) ?? 'available'] += 1;
    });
    // Counted the way the figure beside the field counts it: on hand less
    // what is allocated. Treating available as a fourth exclusive state put
    // "Available 128" under a line reading "139 EA available".
    out.available = pool.length - out.allocated;
    return out;
  }, [pool, unitStates]);

  /** Every unit under its bin, bins in walking order. Built from the pool
   *  rather than the filtered list, so the rail does not rearrange itself
   *  while somebody is typing in the search. */
  const bins = useMemo(() => {
    const map = new Map<string, string[]>();
    pool.forEach((sn) => {
      const bin = binForUnit(activeLine?.sku ?? '', sn);
      const held = map.get(bin);
      if (held) held.push(sn);
      else map.set(bin, [sn]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pool, activeLine?.sku]);

  /** The place in view: the one chosen in the rail, or the first. */
  const here = place ?? bins[0]?.[0] ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((sn, i) => {
      // A search is about the building, not the aisle. Without this the
      // location in view silently bounded it, and a number that exists two
      // rows over came back as no such unit.
      if (!q && here && binForUnit(activeLine?.sku ?? '', sn) !== here) return false;
      // Available is everything not allocated, the same reading the line's
      // own figure uses: quarantined and checked-out units go back too.
      if (stateFilter) {
        const state = unitStates.get(sn) ?? 'available';
        if (stateFilter === 'available' ? state === 'allocated' : state !== stateFilter) return false;
      }
      if (!q) return true;
      // A unit carries the vendor it came back through, so their name finds
      // their units. Searching the one thing the list is grouped by in every
      // other picker was the one thing this field could not do.
      const owner = vendorOf?.(sn) ?? null;
      return (
        sn.toLowerCase().includes(q) ||
        String(i + 1).padStart(3, '0').includes(q) ||
        (owner?.vendorName.toLowerCase().includes(q) ?? false) ||
        (owner?.vendorCode.toLowerCase().includes(q) ?? false)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, search, stateFilter, unitStates, place, activeLine?.sku, lockedVendor]);

  // Rebuild from pool order rather than appending, so the stored list always
  // reads in the same order as the list on screen.
  const commit = (next: Set<string>) => {
    if (activeLine) onChange(activeLine.id, pool.filter((s) => next.has(s)));
  };

  const toggle = (sn: string) => {
    if (blocked(sn)) return;
    const next = new Set(picked);
    if (next.has(sn)) next.delete(sn);
    else next.add(sn);
    commit(next);
  };

  // Select-all reflects the search results, not the full pool.

  /** Who a bulk pick would commit the return to.
   *
   *  One RMA is raised against one vendor, so a selection spanning two of
   *  them is not a selection anybody can confirm. Until the first unit is
   *  picked nothing is locked, and select-all read that as "nothing is out of
   *  bounds": on a part received from three suppliers it took all 164 units
   *  in the pool while the panel beside it said 126 were available from the
   *  vendor -- two numbers about the same click. So the bulk control commits
   *  to a vendor of its own: the one already locked, or the one the first
   *  takeable unit in view came back through. Individual units are unchanged
   *  -- clicking any of them still picks the vendor, which is the rule this
   *  step is built on. */
  const bulkVendor = (() => {
    if (lockedVendor) return lockedVendor;
    for (const sn of filtered) {
      if (stateOf(sn) === 'allocated') continue;
      const owner = vendorFor(sn);
      if (owner) return owner.vendorCode;
    }
    return null;
  })();
  const bulkVendorName = (() => {
    if (!bulkVendor) return null;
    for (const sn of filtered) {
      const owner = vendorFor(sn);
      if (owner?.vendorCode === bulkVendor) return owner.vendorName;
    }
    return null;
  })();
  /** Units the bulk control would take: takeable, and this vendor's. A unit
   *  that names no vendor is nobody else's, so it travels with them. */
  const inBulkVendor = (sn: string) => {
    const owner = vendorFor(sn);
    return !owner || !bulkVendor || owner.vendorCode === bulkVendor;
  };
  /** Select-all means everything that can be selected, for one vendor. */
  const selectable = filtered.filter((sn) => !blocked(sn) && inBulkVendor(sn));
  /** In view, takeable, and somebody else's: what select-all is leaving
   *  behind, which the bar says rather than leaving the count to be worked
   *  out from a list. */
  const otherVendorInView = filtered.filter((sn) => !blocked(sn) && !inBulkVendor(sn)).length;
  /** How many the bulk control takes.
   *
   *  The quantity typed on the line, not the whole pool. Select-all used to
   *  mean every unit this vendor has of the part, which on a return of four
   *  named forty-six and left the user unpicking most of them. The figure on
   *  the left of the field is what the return asked for, so that is what the
   *  control fills, and anything beyond it is picked by hand -- which still
   *  works, and still says so in the footer. */
  const bulkWanted =
    target === undefined ? selectable.length : Math.max(0, Math.min(target, selectable.length));
  /** The next units it would take, in the order the list shows them. */
  const bulkTake = (() => {
    if (target === undefined) return selectable.filter((s) => !picked.has(s));
    const already = selectable.filter((s) => picked.has(s)).length;
    const room = Math.max(0, bulkWanted - already);
    return selectable.filter((s) => !picked.has(s)).slice(0, room);
  })();
  const allFilteredPicked =
    selectable.length > 0 &&
    (target === undefined
      ? selectable.every((s) => picked.has(s))
      : bulkTake.length === 0 && selectable.some((s) => picked.has(s)));
  const someFilteredPicked = !allFilteredPicked && selectable.some((s) => picked.has(s));

  const toggleAll = () => {
    const next = new Set(picked);
    // Filled already, so the control empties what it filled rather than
    // sitting there doing nothing.
    if (allFilteredPicked) selectable.forEach((s) => next.delete(s));
    else bulkTake.forEach((s) => next.add(s));
    commit(next);
  };

  /** The vendor the return is committed to, by name.
   *
   *  The list used to be gathered under vendor headers, which put the answer
   *  above the question: the serials name the vendor, so the vendor belongs
   *  to the step's header once they have spoken, not to a band over every
   *  unit. What is left here is the name, for the one line that has to say
   *  why the other units are shut. */
  const lockedName = useMemo(() => {
    if (lockedVendorName) return lockedVendorName;
    if (!lockedVendor || !vendorOf) return null;
    for (const sn of pool) {
      const owner = vendorFor(sn);
      if (owner?.vendorCode === lockedVendor) return owner.vendorName;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, lockedVendor, vendorOf]);

  /** How many units on this part came from somebody else. Counted over the
   *  whole pool, not the list in view: hiding them emptied the count, which
   *  took the sentence explaining them and the switch that brings them back
   *  off the screen with it. */
  const lockedOut = pool.filter((sn) => otherVendor(sn)).length;

  const unit = activeLine?.uom ?? 'EA';
  // What the count still wants. Zero is the only state the confirm accepts.
  const short = target === undefined ? 0 : target - picked.size;
  const titleSuffix = sourceLabel ?? activeLine?.sku ?? 'this return';

  const inline = variant === 'inline';

  /** Open the full screen once the picks outgrow the panel.
   *
   *  The inline grid holds about two dozen units before the list it is showing
   *  is mostly off screen, and somebody naming forty is then scrolling a
   *  two-column strip to find what they have already taken. The picker has a
   *  full screen for exactly this; it waits to be asked, and nobody asks
   *  halfway through a count. Once per open: reopening the panel deliberately
   *  after it has expanded should not fling it straight back. */
  const outgrown = useRef(false);
  useEffect(() => {
    if (!open) {
      outgrown.current = false;
      return;
    }
    if (!inline || !onExpand || outgrown.current) return;
    if (picked.size <= INLINE_FITS) return;
    outgrown.current = true;
    onExpand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inline, picked.size]);

  const body = (
      <>

        {/* Header — same icon tile, title scale and close affordance as the
            Ship-To picker, so the two read as one family of dialogs. */}
        <div className="flex items-center justify-between gap-3 shrink-0 px-5 pt-4 pb-3 bg-white border-b border-muted">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              <ScanLine className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Select serial numbers to return</h3>
              <p className="text-[11px] text-slate-500 truncate">Select the serial numbers to return from {titleSuffix}</p>
            </div>
          </div>
          {inline && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[#E8ECF1] bg-white px-2.5 text-[11px] text-slate-600 transition-colors hover:border-primary/25"
              style={{ fontWeight: 600 }}
            >
              <Maximize2 className="w-3 h-3" />
              Full screen
            </button>
          )}
          {!inline && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* One search, over everything.
            
            It sat inside the panel, under the location that happened to be
            open, and it searched that location: a unit number typed while
            standing in aisle A returned nothing if the unit was in aisle B.
            A serial is unique in the building, so the field that looks for one
            belongs over the whole picker and reads every place at once. */}
        <div className="shrink-0 border-b border-[#E8ECF1] bg-white px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search every location by vendor or serial number"
              aria-label="Search every location by vendor or serial number"
              className="h-9 w-full rounded-md border border-[#E8ECF1] bg-white pl-9 pr-8 text-[12px] text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* The left panel, straight off `serial-selection-modal.tsx` in the
              cycle count app: 280px of white, one selectable card per place
              the stock sits, with the media tile, the name, its description
              and how many of its units are taken. Selecting one is what the
              right panel is showing, and the card carries the accent bar and
              the ring the source draws. */}
          {bins.length > 1 && (
            <div className="hidden w-[188px] shrink-0 flex-col overflow-y-auto border-r border-border bg-white pt-2 sm:flex">
              <span
                className="mx-1.5 mb-1 px-2 text-[10px] uppercase text-slate-400"
                style={{ fontWeight: 600, letterSpacing: '0.07em' }}
              >
                Location
              </span>
              {/* What is left to pick, across every location this vendor
                  holds it in.
                  
                  The units are the vendor's, wherever they sit: fifty in one
                  aisle and thirty in another is one pool of eighty against a
                  line asking for sixty. The rail was stating each location's
                  own count and leaving the running total to the footer, so
                  "am I done" was a question about a number on the other side
                  of the screen. */}
              {target !== undefined && target > 0 && (
                <div className="mx-1.5 mb-2 rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-2.5 py-2">
                  {/* One figure, said once. It read "0 of 432" beside "432 to
                      pick", which is the same fact twice and left the reader
                      checking whether the two numbers agreed. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                      {picked.size} of {target} picked
                    </span>
                    {picked.size === target ? (
                      <span className="text-[10px] text-emerald-600" style={{ fontWeight: 600 }}>
                        All picked
                      </span>
                    ) : picked.size > target ? (
                      <span className="text-[10px] text-amber-700" style={{ fontWeight: 600 }}>
                        {picked.size - target} over
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-200/70">
                    <span
                      className={`block h-full rounded-full transition-all ${
                        picked.size === target
                          ? 'bg-emerald-500'
                          : picked.size > target
                            ? 'bg-amber-500'
                            : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, Math.round((picked.size / target) * 100))}%` }}
                    />
                  </span>
                </div>
              )}
              {bins.map(([bin, units]) => {
                const on = place === bin || (place === null && bin === bins[0]?.[0]);
                const takenHere = units.filter((sn) => picked.has(sn)).length;
                // While a query is running, each place says how much of the
                // result is in it.
                const matchesHere = search.trim()
                  ? units.filter((sn) => filtered.includes(sn)).length
                  : 0;
                // What can actually be taken here: this vendor's units, not
                // counting anything allocated elsewhere.
                const takeableHere = units.filter((sn) => !blocked(sn) || picked.has(sn)).length;
                return (
                  <div
                    key={bin}
                    role="button"
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setPlace(bin)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      setPlace(bin);
                    }}
                    className={`group relative mx-1.5 mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      on ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary transition-opacity ${
                        on ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <span
                      className={`flex w-6 h-6 shrink-0 items-center justify-center rounded-md border ${
                        on
                          ? 'border-primary/20 bg-white text-primary'
                          : 'border-border bg-slate-50 text-slate-400'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13px] tabular-nums ${on ? 'text-primary' : 'text-foreground'}`}
                        style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                      >
                        {bin}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-slate-400 tabular-nums">
                        {search.trim() ? (
                          <span
                            className={matchesHere > 0 ? (on ? 'text-primary' : 'text-slate-500') : ''}
                            style={{ fontWeight: matchesHere > 0 ? 600 : 400 }}
                          >
                            {matchesHere} {matchesHere === 1 ? 'match' : 'matches'}
                          </span>
                        ) : takenHere > 0 ? (
                          <span className={on ? 'text-primary' : 'text-slate-500'} style={{ fontWeight: 600 }}>
                            {takenHere} of {takeableHere} picked here
                          </span>
                        ) : (
                          `${takeableHere} to pick from here`
                        )}
                      </span>
                      {/* The same bar, per place: how much of what is here has
                          been taken. A location with nothing left reads full,
                          which is what walking the aisle would tell you. */}
                      {takeableHere > 0 && (
                        <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-slate-200/70">
                          <span
                            className={`block h-full rounded-full transition-all ${
                              takenHere >= takeableHere ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((takenHere / takeableHere) * 100))}%`,
                            }}
                          />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* The units of the line the picker was opened on */}
          {/* White, not grey. The grey was doing the job the cards' borders
              were also doing, so every unit sat on a tint inside a box on a
              tint: three edges to read before the number. One surface, and
              the rows carry themselves. */}
          <div className="flex flex-col flex-1 min-w-0 bg-white overflow-hidden">
            {/* The place in view is named on its card in the rail, which is
                also the thing that is highlighted. A band repeating it across
                the top of the panel said the same name twice. */}
            {/* The item, the search and the select-all stay put: they describe
                and act on the whole pool, so they have to remain reachable
                however far down the unit list has been scrolled. */}
            <div className="shrink-0 p-4 pb-3 space-y-2.5 border-b border-[#E8ECF1]">
              {/* Inline, the rail on the left already names the part and says
                  what is on hand, so a card restating it is the same line
                  twice. In the dialog there is no rail, so it stays. */}
              {activeLine && !inline && (
                <div className="flex items-center justify-between gap-3 bg-card border border-[#E8ECF1] rounded-xl px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LineThumbnail {...(activeLine.image ? { src: activeLine.image } : {})} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
                          {activeLine.sku}
                        </span>
                        <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-primary/[0.06] border border-primary/15 text-primary" style={{ fontWeight: 600 }}>
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {sourceLabel ? `${sourceLabel} · ` : ''}
                        {activeLine.receivedQty} {unit} received
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-[#E8ECF1] text-[11px] text-slate-600 whitespace-nowrap tabular-nums" style={{ fontWeight: 600 }}>
                    {picked.size} {unit} to Return
                  </span>
                </div>
              )}

              {/* What state to look at. Every unit carries one, so the list
                  can be cut to it: the quarantine to clear, the allocated
                  units behind a short count, or simply what is free. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { key: null, label: 'All', count: pool.length },
                  { key: 'available' as const, label: 'Available', count: stateCounts.available },
                  { key: 'allocated' as const, label: 'Allocated', count: stateCounts.allocated },
                  {
                    key: 'quarantined' as const,
                    label: 'Quarantined',
                    count: stateCounts.quarantined,
                  },
                  {
                    key: 'checked-out' as const,
                    label: 'Checked out',
                    count: stateCounts['checked-out'],
                  },
                ]).map((opt) => {
                  const active = stateFilter === opt.key;
                  const dead = opt.count === 0 && opt.key !== null;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={dead}
                      aria-pressed={active}
                      onClick={() => setStateFilter(opt.key)}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors ${
                        dead
                          ? 'cursor-not-allowed border-[#E8ECF1] bg-white text-slate-300'
                          : active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-[#E8ECF1] bg-white text-slate-600 hover:border-primary/25'
                      }`}
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {opt.label}
                      <span className="tabular-nums text-[10px] opacity-70">{opt.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Why most of this list is shut, said once, where the shut
                  rows are. A unit carries the vendor it came back through,
                  so the first pick settles the vendor for the whole return
                  and everything that came from anybody else stops being an
                  option. Without this line the greyed rows read as a bug. */}
              {lockedVendor && lockedOut > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <Lock className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <p className="min-w-0 flex-1 text-[11px] leading-[1.5] text-amber-900/80">
                    <span className="text-amber-900" style={{ fontWeight: 600 }}>
                      {lockedOut} {lockedOut === 1 ? 'unit' : 'units'} from other vendors{' '}
                      {lockedOut === 1 ? 'is' : 'are'} locked.
                    </span>{' '}
                    {lockedName
                      ? lockedBy
                        ? `This return goes back to ${lockedName}, ${lockedBy}, so only their units can be added.`
                        : `You've selected a unit from ${lockedName}, so only their units can be added.`
                      : "You've selected a unit from one vendor, so only their units can be added."}
                  </p>
                </div>
              )}
              {/* Before anything is picked, what the next click decides. */}
              {!lockedVendor && vendorOf && (
                <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-2.5 py-2">
                  <Info className="mt-px w-3.5 h-3.5 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 text-[11px] leading-[1.5] text-slate-600">
                    <span className="text-foreground" style={{ fontWeight: 600 }}>
                      Picking a serial number picks the vendor.
                    </span>{' '}
                    The first serial sets the vendor for the whole RMA. Items that vendor can’t
                    take back should be added to a separate RMA, or pick a vendor that can take them
                    all.
                  </p>
                </div>
              )}

              {/* Select-all, its own bar above the grid, acting on whatever
                  the filters have left in view.
                  
                  It waits for the first unit. Offered straight away it was
                  proposing a set before the return had a vendor, on a list
                  where picking a unit is what settles one -- an answer put in
                  front of the question. Once a unit is picked the vendor is
                  known, and filling the rest of the figure from that vendor is
                  a real offer. */}
              {selectable.length > 0 && picked.size > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="w-full flex items-center gap-2.5 p-2 rounded-md bg-card border border-[#E8ECF1] hover:border-primary/25 transition-colors text-left cursor-pointer"
                >
                  <span
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 ${
                      allFilteredPicked || someFilteredPicked
                        ? 'bg-primary'
                        : 'bg-white border-[1.5px] border-border'
                    }`}
                  >
                    {allFilteredPicked ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : someFilteredPicked ? (
                      <Minus className="w-3 h-3 text-white" />
                    ) : null}
                  </span>
                  {/* One line, and no vendor in it until there is one.
                      
                      Before anything is picked the vendor is not settled, so
                      naming the one the control happens to have reached for
                      was the screen answering its own question. Once a unit
                      is picked the vendor is the return's, and then it is
                      worth saying whose the rest are coming from. */}
                  <span
                    className="min-w-0 flex-1 text-[12px] text-foreground"
                    style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                  >
                    {allFilteredPicked
                      ? `Clear the ${selectable.filter((s) => picked.has(s)).length} selected`
                      : target === undefined
                        ? `Select all ${selectable.length} selectable ${selectable.length === 1 ? 'unit' : 'units'}`
                        : picked.size > 0
                          ? `Select the remaining ${bulkTake.length} ${bulkTake.length === 1 ? 'unit' : 'units'}${bulkVendorName ? ` from ${bulkVendorName}` : ''}`
                          : bulkTake.length < bulkWanted
                            ? `Select the ${bulkTake.length} ${bulkTake.length === 1 ? 'unit' : 'units'} available of the ${bulkWanted} wanted`
                            : `Select ${bulkTake.length} ${bulkTake.length === 1 ? 'unit' : 'units'}, the quantity on this line`}
                  </span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-3">
              {/* The same dead end the lot picker draws: one sentence, what
                  was looked through, and the way back. */}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <span className="flex w-10 h-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <Search className="w-5 h-5" />
                  </span>
                  {search.trim() ? (
                    <>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                        Nothing matches "{search.trim()}"
                      </span>
                      <span className="max-w-[320px] text-center text-[11px] text-slate-500">
                        No vendor or serial number on {activeLine?.sku ?? 'this item'} matches what
                        you typed.
                      </span>
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="mt-1 inline-flex h-7 items-center rounded-md border border-[#E8ECF1] bg-white px-2.5 text-[11px] text-slate-600 transition-colors hover:border-primary/30 hover:text-foreground"
                        style={{ fontWeight: 600 }}
                      >
                        Clear the search
                      </button>
                    </>
                  ) : (
                    <span className="text-[12px] text-slate-400">
                      {here ? `No units in ${here}` : 'No units on this line'}
                    </span>
                  )}
                </div>
              )}

              {/* One series, in the order the units are numbered.
                  
                  They were gathered under vendor headers, which said the
                  answer before the question: a serial carries the vendor it
                  came back through, so picking one names the vendor for the
                  whole return and the step's header is where that belongs.
                  What the list has to do is show the numbers, in order, and
                  be honest about which of them this return can still take. */}
              <div className="grid grid-cols-1 gap-1.5 items-start sm:grid-cols-2">
                {filtered.map((sn) => (
                  <UnitCell
                    key={sn}
                    serial={sn}
                    index={String(pool.indexOf(sn) + 1).padStart(3, '0')}
                    picked={picked.has(sn)}
                    state={stateOf(sn)}
                    otherVendor={otherVendor(sn)}
                    search={search}
                    onToggle={() => toggle(sn)}
                  />
                ))}
              </div>
            </div>

            {/* Footer. The dialog keeps one, because it is where Confirm
                lives and a count belongs beside the button that acts on it.
                The panel has neither: the rail beside it already says how
                much of the line is named and the step's own footer says
                whether the step can move on, so a third running total was
                the same figure a third time. */}
            <div
              className={`items-center justify-between gap-3 shrink-0 px-5 py-3 border-t border-muted bg-card ${
                inline ? 'hidden' : 'flex'
              }`}
            >
              <div className="min-w-0">
                {target === undefined ? (
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    {picked.size} {picked.size === 1 ? 'unit' : 'units'} selected
                  </span>
                ) : (
                  <>
                    <p className="text-[12px] tabular-nums">
                      <span
                        className={short === 0 ? 'text-emerald-700' : 'text-foreground'}
                        style={{ fontWeight: 700 }}
                      >
                        {picked.size}
                      </span>
                      <span className="text-slate-500" style={{ fontWeight: 500 }}>
                        {' '}of {target} {unit} selected
                      </span>
                    </p>
                    {short !== 0 && (
                      <p className="text-[11px] text-amber-700 mt-px" style={{ fontWeight: 600 }}>
                        {short > 0
                          ? `${short} still to name. Save these now and add the rest later.`
                          : `${-short} more than the ${target} on this line. Confirming returns ${picked.size}.`}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {/* Cancel closes a dialog. On the step there is nothing to
                    close, and the flow's own Cancel is already in the footer
                    below it. */}
                {!inline && (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="h-9 px-4 rounded-md border border-[#E8ECF1] bg-card text-[12px] text-foreground hover:bg-muted transition-colors cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                )}
                {/* Naming some of them now is the ordinary case, not a failure
                    to finish: the paperwork for the rest is often on somebody
                    else's desk. A short selection confirms, keeps the count the
                    line was given, and leaves the line saying what it owes.
                    Refusing it forced the only other exit, "return 4 instead",
                    which quietly rewrote a return of fifteen into one of four. */}
                {/* Nothing to confirm on a panel: a tick is already the
                    answer, and the step's own Continue is the way out. */}
                {!inline && (
                  <button
                    type="button"
                    disabled={picked.size === 0}
                    onClick={() => {
                      // More ticked than the line asked for is the picker
                      // saying the line was wrong, so the line follows the
                      // units. A short pick keeps the count and leaves the
                      // line saying what it still owes.
                      if (short < 0 && onChangeCount) onChangeCount(picked.size);
                      onOpenChange(false);
                    }}
                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:opacity-100"
                    style={{ fontWeight: 600 }}
                  >
                    {picked.size === 0
                      ? 'Select Units'
                      : short > 0
                        ? `Save ${picked.size}, name the rest later`
                        : `Select ${picked.size} ${picked.size === 1 ? 'Unit' : 'Units'}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
  );

  if (inline) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[240] !max-w-[960px] w-full h-[80vh] p-0 gap-0 rounded-2xl border-0 overflow-hidden flex flex-col"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Select serial units to return</DialogTitle>
        <DialogDescription className="sr-only">
          Choose which physical units this return is sending back.
        </DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}


/** One unit in the pool. Lifted out so the flat list and the bins render the
 *  same cell rather than two that drift apart. */
export function UnitCell({
  serial,
  index,
  picked,
  state = 'available',
  otherVendor = false,
  search,
  onToggle,
}: {
  serial: string;
  index: string;
  picked: boolean;
  /** Allocated units are drawn and refused; quarantined and checked-out ones
   *  are drawn, taken, and tagged so the person picking knows what they have. */
  state?: StockState;
  /** Shipped by somebody other than the vendor this return is committed to.
   *  Drawn and refused, with the way out said on the hover. */
  otherVendor?: boolean;
  search: string;
  onToggle: () => void;
}) {
  const blocked = state === 'allocated' || otherVendor;
  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked}
      onClick={blocked ? undefined : onToggle}
      onKeyDown={(e) => {
        if (blocked) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onToggle();
      }}
      title={
        otherVendor
          ? 'These came from a different vendor. Deselect the current vendor\u2019s serials to choose these instead.'
          : blocked
          ? 'Allocated to a job or sales order. Adjust it in your allocation module.'
          : state === 'quarantined'
            ? 'Quarantined. It can still be returned.'
            : state === 'checked-out'
              ? 'Checked out. It can still be returned.'
              : undefined
      }
      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md border transition-colors text-left ${
        blocked
          ? // A stroke, faint but there. Borderless they read as loose text
            // floating on the panel rather than rows that exist and are
            // shut: the box is what says a unit is there and cannot be had.
            'cursor-not-allowed border-[#EDF1F5] bg-slate-50/60'
          : picked
            ? 'cursor-pointer border-primary/30 bg-blue-50/70'
            : // A stroke before it is touched, as the shut rows have one.
              // Waiting for a hover to draw the box left the untouched units
              // reading as loose text, and a unit you have not picked yet is
              // the one thing on this list you are meant to be looking at.
              'cursor-pointer border-[#E8ECF1] bg-white hover:border-primary/30 hover:bg-slate-50/60'
      }`}
    >
      <span
        className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 ${
          blocked
            ? 'bg-white border-[1.5px] border-slate-200 text-slate-300'
            : picked
              ? 'bg-primary'
              : 'bg-white border-[1.5px] border-border'
        }`}
      >
        {blocked ? (
          <Lock className="w-[10px] h-[10px]" />
        ) : picked ? (
          <Check className="w-[11px] h-[11px] text-white" />
        ) : null}
      </span>
      {/* The row number is an ordinal, not a figure to read: it is set
          small and quiet so the serial beside it is the thing the eye lands
          on. The two were the same size and weight, which made every row
          read as two numbers of equal standing. */}
      <span
        className={`w-[28px] shrink-0 text-right text-[10px] tabular-nums ${
          blocked ? 'text-slate-300' : 'text-slate-400'
        }`}
        style={{ fontWeight: 600, letterSpacing: '0.02em' }}
      >
        {index}
      </span>
      <TruncatedSerial
        serial={serial}
        highlight={highlightMatch}
        query={search}
        className={`text-[13px] tabular-nums flex-1 min-w-0 text-left ${
          blocked ? 'text-slate-400' : picked ? 'text-primary' : 'text-foreground'
        }`}
        style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
      />
      {/* Every unit says where it stands, the free ones included: a list
          where only the exceptions are labelled reads as a list of exceptions
          with unlabelled units of unknown kind between them. */}
      {/* Only what is out of the ordinary. Every row carried a tag, so two
          thirds of the list said AVAILABLE and the units that were not
          available had nothing to stand out against. Free stock says so by
          saying nothing. */}
      {!otherVendor && state !== 'available' && (
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[10px] uppercase whitespace-nowrap ${
            blocked
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-amber-200 bg-amber-50 text-amber-700'
          }`}
          style={{ fontWeight: 600, letterSpacing: '0.05em' }}
        >
          {STOCK_STATE_LABEL[state]}
        </span>
      )}
    </div>
  );
}
