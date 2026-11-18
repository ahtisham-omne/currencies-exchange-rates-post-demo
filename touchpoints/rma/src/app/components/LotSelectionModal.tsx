/**
 * Lot picker — a batch opened onto the deliveries that brought it in.
 *
 * Ported from the count planner's Configure step
 * (`cycle-count/_components/create/StepConfigure.tsx`), which nests a lot into
 * the locations it is held at and asks for a quantity, or a list of units,
 * against each one. A return has no locations to walk to, but it has the same
 * second level and this flow already turns on it: the receiving documents. So
 * a lot here is a block with its total on the right, and under it a row per
 * delivery, each capped by what that delivery actually brought in.
 *
 * What the row asks depends on the control type, exactly as the source's
 * `LocationRow` does:
 *
 *   LOT Non-Serialized   a quantity, because one of these is any other
 *   LOT Serialized       `3 / 11 units`, opening the units held in that batch
 *                        on that document, ticked by number
 *
 * Which is the whole reason the master carries four control types rather than
 * three. "Lot tracked" hid the difference, and the difference is the question.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Package, Layers, Search, X, Check, MapPin, ChevronDown, Lock, Maximize2, Minus} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { binForUnit, type RMALotAllocation, trackingModeFor } from '@/app/data/mockRMAs';
import { AvailableInfo } from '@/app/components/rma/AvailableInfo';
import { useRefusalNotice } from '@/app/components/rma/QtyUomField';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { vendorAddress } from '@/app/data/mockVendors';

/** The partner module's vendor record, as the invoice table links to it. */
const VENDOR_DETAIL_URL = 'https://partner-management-module.lovable.app/vendors/v-001';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  lotBlocksFor,
  lotVendorFor,
  lotUnitPool,
  STOCK_STATE_LABEL,
  stockSplit,
  unitStatesFor,
  type LotBlock,
  type LotUnit,
  type StockState,
} from '@/app/data/itemProvenance';
import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { UnitCell } from '@/app/components/SerialSelectionModal';
import { formatDate, formatQty } from '@/app/components/vendorSelectionModel';

export interface LotSelectionLine {
  id: string;
  sku: string;
  description?: string;
  image?: string;
  receivedQty: number;
  uom?: string;
}

/** How many units a batch shows before it asks to be opened out. A batch in
 *  stock for two years holds hundreds, and a picker is not an archive. */
const UNITS_SHOWN = 16;

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
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="rounded-md border border-border object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}


/**
 * How much of one batch is coming back.
 *
 * Drawn straight off the committed figure, the box lost the decimal point as
 * it was typed: 1.75 committed as 1, redrew as "1", and the 75 ran on behind
 * it as 175, which the ceiling then showed as the 126 the batch happened to
 * hold. The draft is held here so what was typed stands, and a figure past
 * what the batch has is cut to it out loud.
 */
function LotQtyInput({
  value,
  max,
  unit,
  disabled,
  ariaLabel,
  title,
  className,
  onChange,
}: {
  value: number;
  max: number;
  unit: string;
  disabled: boolean;
  ariaLabel: string;
  title?: string | undefined;
  className: string;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(() => (value > 0 ? String(value) : ''));
  const mine = useRef<number | null>(null);
  const [capped, sayCapped] = useRefusalNotice();
  const [decimalRefused, refuseDecimal] = useRefusalNotice();

  useEffect(() => {
    if (mine.current !== null && mine.current === value) { mine.current = null; return; }
    setDraft(value > 0 ? String(value) : '');
  }, [value]);

  return (
    <span className="relative inline-flex">
      <input
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        placeholder="0"
        aria-label={ariaLabel}
        {...(title ? { title } : {})}
        className={className}
        onChange={(e) => {
          const next = e.target.value.replace(',', '.');
          if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
          // Whole units: a lot is counted in them, so half of one cannot be
          // picked out of it. The fraction is let into the box and the pick
          // cleared, never swallowed -- dropping the keystroke is what turned
          // 3.5 into 35, the dot discarded and the 5 running on behind the 3.
          if (next.includes('.')) {
            setDraft(next);
            refuseDecimal();
            mine.current = 0;
            onChange(0);
            return;
          }
          const n = next.trim() === '' ? 0 : Number(next);
          if (!Number.isFinite(n) || n < 0) return;
          if (n > max) {
            sayCapped();
            setDraft(String(max));
            mine.current = max;
            onChange(max);
            return;
          }
          setDraft(next);
          mine.current = n;
          onChange(n);
        }}
      />
      {(capped || decimalRefused) && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
          style={{ fontWeight: 500 }}
        >
          {decimalRefused ? `Whole ${unit} only.` : `This batch has ${formatQty(max)} ${unit}.`}
        </span>
      )}
    </span>
  );
}

export function LotSelectionModal({
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
  vendorCode = null,
  lockedVendor = null,
  lockedVendorName = null,
  lockedBy = null,
  onExpand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lot-controlled lines on the return, of which `activeLineId` names the one
   *  being picked for. */
  lines: LotSelectionLine[];
  activeLineId: string | null;
  selected: Record<string, RMALotAllocation[]>;
  onChange: (lineId: string, next: RMALotAllocation[]) => void;
  /** Receiving document the batches were booked in on, shown in the title. */
  sourceLabel?: string;
  /** How much the first step said was going back. The picker counts against
   *  it rather than replacing it. */
  target?: number | undefined;
  /** Take a different quantity on purpose, when the batches on hand do not add
   *  up to what was asked for. */
  onChangeCount?: ((next: number) => void) | undefined;
  /** Where it is drawn. `inline` is the same picker with its dialog chrome
   *  taken off, standing in the step's own panel: the panel has the room, the
   *  picks apply as they are made, and a dialog over an empty panel was two
   *  clicks around a list. The serial picker is drawn the same way. */
  variant?: 'dialog' | 'inline';
  /** One vendor's share of the batches, when the picker is opened from their
   *  row. A lot arrives on receipts and every receipt names a supplier, so a
   *  batch can be cut to the part of it that came from one of them. */
  vendorCode?: string | null;
  /** The vendor this return is already committed to, from the first unit or
   *  batch picked anywhere on it. A numbered unit from anybody else is drawn
   *  and refused, exactly as the serial picker draws it. A plain batch cannot
   *  be refused a unit at a time, so what is shown is their share of it. */
  lockedVendor?: string | null;
  /** Their name, for the line that explains the locks. A plain lot line has
   *  no numbered units to read it off, so the step passes it in. */
  lockedVendorName?: string | null;
  /** How this return came to be with them, as a clause that follows the name:
   *  "chosen on STEEL-001". The lock is often made on another line, and a
   *  picker refusing eleven batches has to be able to say which. */
  lockedBy?: string | null;
  /** Throw the inline picker full screen. */
  onExpand?: (() => void) | undefined;
}) {
  const [search, setSearch] = useState('');
  /** One aisle-rack-bin, or every one of them. Somebody pulling stock works a
   *  location at a time, so the picker can be narrowed to the one they are
   *  standing in: for numbered units that is the unit's own bin, for a plain
   *  batch it is where the batch is held. */
  const [place, setPlace] = useState<string | null>(null);
  /** Batches whose units are shown in full. A batch holds more units than a
   *  panel does, and the first dozen answer most returns. */
  const [openedLots, setOpenedLots] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPlace(null);
      setOpenedLots(new Set());
    }
  }, [open]);

  const activeId = lines.find((l) => l.id === activeLineId)?.id ?? lines[0]?.id;
  // A different part is a different warehouse: its bins are its own, and the
  // search is about its lots. Carrying either across made the picker open on a
  // location the part is not held in, showing nothing.
  useEffect(() => {
    setSearch('');
    setPlace(null);
    setActiveLot(null);
    setStateFilter(null);
    setOpenedLots(new Set());
  }, [activeId]);

  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines[0];
  const unit = activeLine?.uom ?? 'EA';
  const mode = activeLine ? trackingModeFor(activeLine.sku) : 'lot';
  const serialized = mode === 'lot-serialized';

  const blocks = useMemo(() => {
    const all = activeLine ? lotBlocksFor(activeLine.sku, unit) : [];
    // A batch holds stock from several suppliers at once, so under a lock it
    // is cut to the locked vendor's share of it rather than refused whole.
    // A batch they never sent stays on the list all the same, shut: dropping
    // it made batches disappear off the screen the moment a serial named a
    // vendor, and a batch that is on the shelf has to be findable even when
    // this return cannot take it.
    // Whole batches, never a share of one. A lot arrives from one supplier
    // and is held as that supplier's batch, so there is no such thing as
    // "their part of it": the return can take the batch or it cannot, and
    // the list says which by shutting the ones it cannot.
    const scope = vendorCode ?? lockedVendor;
    if (!scope) return all;
    return all.map((b) => ({
      ...b,
      theirs: lotVendorFor(b)?.vendorCode === scope ? 1 : 0,
    }));
  }, [activeLine, unit, vendorCode, lockedVendor]);

  /** Batches this return cannot take: the locked vendor never sent them. */
  const lockedLots = useMemo(
    () => new Set(blocks.filter((b) => 'theirs' in b && b.theirs === 0).map((b) => b.lot)),
    [blocks],
  );
  const lotLocked = (lot: string) => lockedLots.has(lot);

  /** Every unit of the part, kept by batch. Built once: the pool is the same
   *  list the later steps read a vendor and a receipt off. */
  const unitsByLot = useMemo(() => {
    const out = new Map<string, LotUnit[]>();
    if (!activeLine || !serialized) return out;
    lotUnitPool(activeLine.sku, unit)
      .filter((u) => !vendorCode || u.vendorCode === vendorCode)
      .forEach((u) => {
      const at = out.get(u.lot);
        if (at) at.push(u);
        else out.set(u.lot, [u]);
      });
    return out;
  }, [activeLine, unit, serialized, vendorCode]);

  /** Where each unit stands, on a lot-serialized part. Allocated units are
   *  committed elsewhere and cannot go back; the rest can, and say what they
   *  are. */
  const unitStates = useMemo(() => {
    const out = new Map<string, StockState>();
    if (!activeLine || !serialized) return out;
    // Per batch, under the same key the batch's own figures are drawn from.
    // Spread over the whole part instead, the chips counted one distribution
    // and the row above them stated another: a batch listed as "139 EA
    // available" sat over chips reading All 140, Available 128.
    unitsByLot.forEach((units, lot) => {
      unitStatesFor(
        `${activeLine.sku}:${lot}`,
        units.map((u) => u.serial),
      ).forEach((state, serial) => out.set(serial, state));
    });
    return out;
  }, [activeLine, serialized, unitsByLot]);
  const stateOf = (serial: string): StockState => unitStates.get(serial) ?? 'available';
  /** Which supplier each numbered unit came back through. */
  const owners = useMemo(() => {
    const out = new Map<string, string>();
    [...unitsByLot.values()].flat().forEach((u) => out.set(u.serial, u.vendorCode));
    return out;
  }, [unitsByLot]);
  /** Which batch each unit sits in, since that is what decides whether this
   *  return can take it. */
  const lotOfUnit = useMemo(() => {
    const out = new Map<string, string>();
    unitsByLot.forEach((units, lot) => units.forEach((u) => out.set(u.serial, lot)));
    return out;
  }, [unitsByLot]);
  /** Somebody else's unit. Drawn and refused rather than hidden: one RMA is
   *  raised against one vendor, and a unit that quietly disappeared read as
   *  stock that is not there. */
  /** A unit this return cannot take. It is a question about the unit's
   *  batch, not about the unit: every unit in a lot came in from the same
   *  supplier, so refusing them one at a time was answering a question
   *  nobody asks. */
  const otherVendorUnit = (serial: string) => {
    if (!lockedVendor) return false;
    const lot = lotOfUnit.get(serial);
    return lot ? lotLocked(lot) : (owners.get(serial) ?? lockedVendor) !== lockedVendor;
  };
  /** How many of this part's units sit in a batch this return cannot take.
   *  Counted for the select-all and the state chips; the line that explains
   *  the lock counts batches, because that is the thing that locks. */
  const lockedOutUnits = [...owners.keys()].filter((sn) => otherVendorUnit(sn)).length;
  const lockedName = useMemo(() => {
    if (!lockedVendor) return null;
    if (lockedVendorName) return lockedVendorName;
    for (const u of [...unitsByLot.values()].flat()) {
      if (u.vendorCode === lockedVendor) return u.vendorName;
    }
    return null;
  }, [unitsByLot, lockedVendor, lockedVendorName]);

  /** Whether anything here can still be picked. Where nothing can, the line
   *  is in the step's own dead-end band and this one would be the same fact
   *  said twice, one under the other. */
  const someOpen = serialized
    ? [...owners.keys()].some((sn) => !otherVendorUnit(sn))
    : lockedLots.size < blocks.length;
  const blockedUnit = (serial: string) =>
    stateOf(serial) === 'allocated' || otherVendorUnit(serial);

  /** How much of one batch can go back. The same arithmetic the quantity step
   *  does on the line, done per batch. */
  const splitOf = (block: LotBlock) =>
    activeLine ? stockSplit(`${activeLine.sku}:${block.lot}`, block.totalQty) : null;

  /** What is picked, by batch. A pick is a batch and how much of it: the
   *  documents behind it are the batch's own business. */
  const picked = useMemo(() => {
    const out = new Map<string, RMALotAllocation>();
    (activeLine ? selected[activeLine.id] ?? [] : []).forEach((a) => out.set(a.lot, a));
    return out;
  }, [activeLine, selected]);

  /** Where this part is held, and how much of it is in each place. */
  const places = useMemo(() => {
    const counts = new Map<string, number>();
    if (!activeLine) return [];
    if (serialized) {
      unitsByLot.forEach((units) =>
        units.forEach((u) => {
          const bin = binForUnit(activeLine!.sku, u.serial);
          counts.set(bin, (counts.get(bin) ?? 0) + 1);
        }),
      );
    } else {
      blocks.forEach((b) => counts.set(b.bin, (counts.get(b.bin) ?? 0) + b.totalQty));
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeLine, serialized, unitsByLot, blocks]);

  /** The units of a batch, narrowed to the location in view. */
  /** One state, or all of them. A unit inside a batch stands somewhere the
   *  same way a unit on its own does, so the list can be cut to it the same
   *  way: the quarantine to clear, the allocated units behind a short count,
   *  or simply what is free. */
  const [stateFilter, setStateFilter] = useState<StockState | null>(null);

  /** What a query names when it names a batch: its code, its date, or the
   *  supplier it came in from. Searching a vendor is searching their batches,
   *  because a batch belongs to one of them -- and it was the one thing the
   *  field could not find, so a picker opened from a vendor's name had to be
   *  read rather than searched. */
  const matchesBatch = (block: LotBlock | undefined, q: string) => {
    if (!block) return false;
    const owner = lotVendorFor(block);
    return (
      block.lot.toLowerCase().includes(q) ||
      block.expiry.includes(q) ||
      (owner?.vendorName.toLowerCase().includes(q) ?? false) ||
      (owner?.vendorCode.toLowerCase().includes(q) ?? false)
    );
  };

  /** Whether a unit belongs under the chip that is pressed.
   *
   *  Available is everything that is not allocated, which is what the word
   *  means on the line, in the unit menu and in the (i) beside the figure:
   *  quarantined and checked-out units can go back, and often that is why
   *  they are going back. Reading it as a fourth exclusive state made the
   *  chip disagree with every other statement of availability on screen. */
  const inState = (serial: string) => {
    if (!stateFilter) return true;
    if (stateFilter === 'available') return stateOf(serial) !== 'allocated';
    return stateOf(serial) === stateFilter;
  };

  const unitsShownFor = (lot: string) => {
    const all = unitsByLot.get(lot) ?? [];
    const q = search.trim().toLowerCase();
    // A query that names the batch shows the batch: all of its units, not the
    // handful whose numbers happen to contain the vendor's letters. Only a
    // query that names nothing about the batch is read as a unit number.
    const wholeBatch = !!q && matchesBatch(blocks.find((b) => b.lot === lot), q);
    return all.filter(
      (u) =>
        (!place || binForUnit(activeLine!.sku, u.serial) === place) &&
        inState(u.serial) &&
        (!q || wholeBatch || u.serial.toLowerCase().includes(q)),
    );
  };

  /** How many units of the batch in view stand in each state. */
  const stateCounts = (lot: string | null) => {
    const out: Record<StockState, number> = {
      available: 0,
      allocated: 0,
      quarantined: 0,
      'checked-out': 0,
    };
    const units = lot ? unitsByLot.get(lot) ?? [] : [];
    units.forEach((u) => {
      out[stateOf(u.serial)] += 1;
    });
    out.available = units.length - out.allocated;
    return out;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blocks.filter((b) => {
      if (place) {
        const here = serialized
          ? (unitsByLot.get(b.lot) ?? []).some((u) => binForUnit(activeLine!.sku, u.serial) === place)
          : b.bin === place;
        if (!here) return false;
      }
      if (!q) return true;
      return (
        matchesBatch(b, q) ||
        (unitsByLot.get(b.lot) ?? []).some((u) => u.serial.toLowerCase().includes(q))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, search, unitsByLot, place, serialized, activeLine]);

  /** Which batch the right panel is showing. The rail on the left is the
   *  switch, and it opens on the first batch rather than on all of them: a
   *  panel headed by every lot at once is not a lot. */
  const [activeLot, setActiveLot] = useState<string | null>(null);
  const lotInView =
    activeLot && filtered.some((b) => b.lot === activeLot) ? activeLot : filtered[0]?.lot ?? null;
  const inViewBlock = filtered.find((b) => b.lot === lotInView) ?? null;

  /** Written back in block order, so the stored list always reads in the same
   *  order as the list on screen. A batch at nothing is not on the return. */
  const commit = (next: Map<string, RMALotAllocation>) => {
    if (!activeLine) return;
    onChange(
      activeLine.id,
      blocks.map((b) => next.get(b.lot)).filter((a): a is RMALotAllocation => !!a && a.qty > 0),
    );
  };

  const setLotQty = (block: LotBlock, raw: string) => {
    if (lotLocked(block.lot)) return;
    if (!/^\d*(?:\.\d{0,2})?$/.test(raw)) return;
    const n = raw.includes('.') ? 0 : raw.trim() === '' ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const next = new Map(picked);
    const clamped = Math.min(n, splitOf(block)?.available ?? block.totalQty);
    if (clamped <= 0) next.delete(block.lot);
    else next.set(block.lot, { lot: block.lot, qty: clamped });
    commit(next);
  };

  const setLotUnits = (block: LotBlock, unitsIn: string[]) => {
    const units = unitsIn.filter((u) => !blockedUnit(u));
    const next = new Map(picked);
    if (units.length === 0) next.delete(block.lot);
    else next.set(block.lot, { lot: block.lot, qty: units.length, serials: units });
    commit(next);
  };

  /** LOT Serialized reads exactly like the serial picker: the batch in view
   *  is already named on its card in the rail, so the panel under the search
   *  is a flat grid of its units. A band repeating the batch over that grid
   *  said the same name twice. */
  const viewUnits = inViewBlock ? unitsShownFor(inViewBlock.lot) : [];
  const viewPick = inViewBlock ? picked.get(inViewBlock.lot) : undefined;
  const viewChosen = new Set(viewPick?.serials ?? []);
  const viewTakeable = viewUnits.filter((u) => !blockedUnit(u.serial));
  const viewOpened = inViewBlock ? openedLots.has(inViewBlock.lot) || !!search.trim() : false;
  const viewShown = viewOpened ? viewUnits : viewUnits.slice(0, UNITS_SHOWN);
  /** How many units this batch is being asked for: what the line wants, less
   *  whatever other batches on it are already covering. */
  const wantedHere = (() => {
    if (target === undefined) return viewTakeable.length;
    const takenElsewhere = [...picked.entries()]
      .filter(([lot]) => lot !== inViewBlock?.lot)
      .reduce((n, [, a]) => n + a.qty, 0);
    return Math.max(0, Math.round((target - takenElsewhere) * 100) / 100);
  })();
  /** The next units it would take, in the order the batch lists them. Taking
   *  the whole batch put ninety-nine units against a return of six and then
   *  showed the user an error about the figure it had just written. */
  /** While a query is running, every unit that matches it, whatever batch it
   *  is in, kept under the batch it belongs to. The panel showed the batch in
   *  view and nothing else, so a number held two batches over came back as no
   *  such unit. */
  const searchHits: [string, LotUnit[]][] = (() => {
    const q = search.trim().toLowerCase();
    if (!q || !serialized) return [];
    const out: [string, LotUnit[]][] = [];
    filtered.forEach((b) => {
      const hits = (unitsByLot.get(b.lot) ?? []).filter(
        (u) =>
          (!place || binForUnit(activeLine!.sku, u.serial) === place) &&
          inState(u.serial) &&
          (matchesBatch(b, q) || u.serial.toLowerCase().includes(q)),
      );
      if (hits.length > 0) out.push([b.lot, hits]);
    });
    return out;
  })();

  const viewTake = viewTakeable
    .filter((u) => !viewChosen.has(u.serial))
    .slice(0, Math.max(0, wantedHere - viewChosen.size));
  const viewAllOn = viewTakeable.length > 0 && viewTake.length === 0 && viewChosen.size > 0;
  const viewSomeOn = !viewAllOn && viewUnits.some((u) => viewChosen.has(u.serial));
  const toggleViewAll = () => {
    if (!inViewBlock) return;
    const here = viewTakeable.map((u) => u.serial);
    const kept = (viewPick?.serials ?? []).filter((sn) => !here.includes(sn));
    setLotUnits(
      inViewBlock,
      viewAllOn
        ? kept
        : [...kept, ...(viewPick?.serials ?? []).filter((sn) => here.includes(sn)), ...viewTake.map((u) => u.serial)],
    );
  };

  const takenQty = [...picked.values()].reduce((n, a) => n + a.qty, 0);
  const lotsUsed = new Set([...picked.values()].map((a) => a.lot)).size;
  const onHand = blocks.reduce((n, b) => n + b.totalQty, 0);
  const short = target === undefined ? 0 : Math.round((target - takenQty) * 100) / 100;
  const titleSuffix = sourceLabel ?? activeLine?.sku ?? 'this return';
  const inline = variant === 'inline';

  const body = (
      <>
        <div className="flex items-center justify-between gap-3 shrink-0 px-5 pt-4 pb-3 bg-white border-b border-muted">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                Select lots to return
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {serialized
                  ? `Select the lots to return from ${titleSuffix}, and the serial numbers inside them`
                  : `Select the lots to return from ${titleSuffix}, and the quantity from each`}
              </p>
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

        {/* One search, over every batch.
            
            It stood inside the panel, under whichever batch was open, and a
            unit number typed there was looked for in that batch alone. A
            number is unique across the part, so the field that looks for one
            belongs over the whole picker and reads every batch at once. */}
        <div className="shrink-0 border-b border-[#E8ECF1] bg-white px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                serialized
                  ? 'Search every lot by vendor, lot, expiry or serial number'
                  : 'Search every lot by vendor, lot or expiry'
              }
              aria-label="Search vendors, lots and serial numbers"
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
          {/* The left panel, the cycle count picker's own: 280px of white,
              one selectable card per batch, with its tile, its number, what it
              holds, where it is held and how much of it is taken. Selecting a
              card is what the right panel is showing. */}
          {/* The rail stands whatever the search says.
              
              It listed the batches the query matched, so searching one unit
              number collapsed the list to a single card and then hid it
              altogether: the one moment you most want to know which batch the
              thing is in, the map of the part disappeared. It lists every
              batch now, and while a query runs each card says how much of the
              result is in it. */}
          {blocks.length > 1 && (
            <div className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border bg-white pt-2 sm:flex">
              {/* What is left to pick, across every batch.
                  
                  The same reading the serial picker's location rail carries:
                  the line asked for a figure, the batches are where it comes
                  from, and "am I done" should be answerable without adding up
                  the cards. */}
              {target !== undefined && target > 0 && (
                <div className="mx-2 mb-2 rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-2.5 py-2">
                  {/* One figure, said once. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-[11px] text-foreground tabular-nums"
                      style={{ fontWeight: 600 }}
                    >
                      {formatQty(takenQty)} of {formatQty(target)} {unit} picked
                    </span>
                    {/* Past the figure is not done. Taking more than the
                        line asked for printed "All picked" in green while the
                        footer called the same return one issue short. */}
                    {short === 0 ? (
                      <span className="text-[10px] text-emerald-600" style={{ fontWeight: 600 }}>
                        All picked
                      </span>
                    ) : short < 0 ? (
                      <span className="text-[10px] text-amber-700" style={{ fontWeight: 600 }}>
                        {formatQty(-short)} over
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-200/70">
                    <span
                      className={`block h-full rounded-full transition-all ${
                        short === 0 ? 'bg-emerald-500' : short < 0 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((takenQty / target) * 100))}%`,
                      }}
                    />
                  </span>
                </div>
              )}
              {(search.trim() ? blocks : filtered).map((block) => {
                const on = block.lot === lotInView;
                // While a query runs, how much of the result this batch holds.
                const hits = search.trim()
                  ? (searchHits.find(([lot]) => lot === block.lot)?.[1].length ?? 0)
                  : 0;
                const pick = picked.get(block.lot);
                const sp = splitOf(block);
                const shut = lotLocked(block.lot);
                const owner = lotVendorFor(block);
                // 400ms, not 120. The rail is a list people run their eye
                // down, and a card that opened on the way past put a 320px
                // panel over the next three batches every time the cursor
                // crossed them. The delay is what makes it a thing you ask
                // for rather than a thing that happens to you.
                return (
                  <HoverCard key={block.lot} openDelay={400} closeDelay={120}>
                    <HoverCardTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setActiveLot(block.lot)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      setActiveLot(block.lot);
                    }}
                    className={`group relative mx-2 mb-1 flex cursor-pointer items-start gap-2.5 rounded-lg p-2 text-left transition-colors ${
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
                      className={`flex w-9 h-9 shrink-0 items-center justify-center rounded-md border ${
                        shut
                          ? 'border-slate-200 bg-slate-50 text-slate-300'
                          : 'border-violet-200 bg-violet-50 text-violet-700'
                      }`}
                    >
                      {shut ? <Lock className="w-3.5 h-3.5" /> : <Layers className="w-4 h-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[12px] ${
                          shut ? 'text-slate-400' : on ? 'text-primary' : 'text-foreground'
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {block.lot}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400 tabular-nums">
                        {search.trim()
                          ? `${hits} ${hits === 1 ? 'match' : 'matches'}${owner ? ` · ${owner.vendorName}` : ''}`
                          : shut
                            ? `From ${owner?.vendorName ?? 'another vendor'}`
                            : `${owner ? `${owner.vendorName} · ` : ''}${formatQty(sp?.available ?? block.totalQty)} ${unit} available`}
                      </span>
                      {pick && pick.qty > 0 && (
                        <span
                          className={`mt-0.5 block truncate text-[11px] tabular-nums ${on ? 'text-primary' : 'text-slate-500'}`}
                          style={{ fontWeight: 500 }}
                        >
                          {formatQty(pick.qty)} {unit} selected
                        </span>
                      )}
                      {/* How much of this batch is taken, where any of it is.
                          A shut batch has nothing to report. */}
                      {!shut && (sp?.available ?? block.totalQty) > 0 && (pick?.qty ?? 0) > 0 && (
                        <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-slate-200/70">
                          <span
                            className={`block h-full rounded-full transition-all ${
                              (pick?.qty ?? 0) >= (sp?.available ?? block.totalQty)
                                ? 'bg-emerald-500'
                                : 'bg-primary'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  ((pick?.qty ?? 0) / (sp?.available ?? block.totalQty)) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </span>
                      )}
                    </span>
                  </div>
                    </HoverCardTrigger>
                    {/* The batch, opened without opening it.
                        
                        A card in the rail has room for a code, a figure and a
                        bin, and the question a picker actually asks of a batch
                        is whose it is and what came in when. So the deliveries
                        behind it read on hover, the way a vendor's do
                        elsewhere in the flow: supplier at the top, the
                        documents that built the batch under it, the total
                        under those. */}
                    <HoverCardContent side="right" align="start" sideOffset={10} className="w-[320px] p-0">
                      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                        <span className="flex w-8 h-8 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-700">
                          <Layers className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                            {block.lot}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            Expires {block.expiry} · {block.bin}
                          </span>
                        </span>
                      </div>

                      {/* Whose batch this is, said as its own row rather than
                          as a line under the code.
                          
                          A batch belongs to one supplier and that is the fact
                          the picker turns on -- it decides whether the batch
                          can go on this return at all -- so it gets the label,
                          the avatar and a way through to the vendor record
                          rather than a grey subtitle. */}
                      {owner && (
                        <div className="border-b border-border px-3 py-2.5">
                          <p
                            className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400"
                            style={{ fontWeight: 600 }}
                          >
                            Vendor
                          </p>
                          <a
                            href={VENDOR_DETAIL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="group flex items-center gap-2.5 rounded-lg border border-[#E8ECF1] bg-white px-2.5 py-2 transition-colors hover:border-primary/30 hover:bg-blue-50/40"
                          >
                            <VendorAvatar name={owner.vendorName} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate text-[12px] text-foreground transition-colors group-hover:text-primary"
                                style={{ fontWeight: 600 }}
                              >
                                {owner.vendorName}
                              </span>
                              <span className="block truncate text-[10px] text-slate-400">
                                {vendorAddress(owner.vendorCode) ?? owner.vendorCode}
                              </span>
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-primary" />
                          </a>
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[11px]">
                        {sp && (
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-slate-500">Available to return</span>
                            <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                              {formatQty(sp.available)} {unit}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* What came in, and when. A batch is built out of
                          deliveries, so this is the batch rather than a note
                          about it. */}
                      <div className="border-t border-border px-3 py-2.5">
                        <p className="text-[11px] text-slate-500">
                          {owner ? `Received from ${owner.vendorName}` : 'Received'}
                        </p>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {block.receipts.slice(0, 5).map((r) => (
                            <div
                              key={`${r.grnNumber}-${r.date}`}
                              className="flex items-baseline justify-between gap-3 text-[11px]"
                            >
                              <span className="min-w-0 truncate text-slate-600">
                                {r.grnNumber}
                                <span className="text-slate-400"> · {r.date}</span>
                              </span>
                              <span className="shrink-0 text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                                {formatQty(r.qty)} {unit}
                              </span>
                            </div>
                          ))}
                          {block.receipts.length > 5 && (
                            <span className="text-[11px] text-slate-400">
                              and {block.receipts.length - 5} more
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-[11px]">
                          <span className="text-foreground" style={{ fontWeight: 600 }}>
                            In this lot
                          </span>
                          <span className="text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                            {formatQty(block.totalQty)} {unit}
                          </span>
                        </div>
                      </div>
                      {pick && pick.qty > 0 && (
                        <p className="border-t border-border px-3 py-2 text-[11px] text-primary tabular-nums" style={{ fontWeight: 600 }}>
                          {formatQty(pick.qty)} {unit} of this lot is on the return
                        </p>
                      )}
                      {/* Whose lot it is and who the return is with are both
                          already said outside this card -- the banner over the
                          list, the chip on the row -- so the card stays about
                          the batch itself. */}
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
          )}

          {/* White, not grey. The grey was doing the job the cards' borders
              were also doing, so every unit sat on a tint inside a box on a
              tint: three edges to read before the number. One surface, and
              the rows carry themselves. */}
          <div className="flex flex-col flex-1 min-w-0 bg-white overflow-hidden">
            {/* The batch in view is named on its card in the rail, which is
                also the thing that is highlighted, so the panel does not
                repeat it across the top. */}
            <div className="shrink-0 p-4 pb-3 space-y-4 border-b border-[#E8ECF1]">
              {/* Inline, the rail is already showing the part, its chip and
                  its figure two inches to the left. The serial picker leaves
                  its own card out for the same reason. */}
              {activeLine && !inline && (
                <div className="flex items-center justify-between gap-3 bg-card border border-[#E8ECF1] rounded-xl px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LineThumbnail {...(activeLine.image ? { src: activeLine.image } : {})} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-sm text-foreground whitespace-nowrap"
                          style={{ fontWeight: 600 }}
                        >
                          {activeLine.sku}
                        </span>
                        <TrackingTag mode={mode} size="md" />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate tabular-nums">
                        {formatQty(onHand)} {unit} across {blocks.length}{' '}
                        {blocks.length === 1 ? 'lot' : 'lots'}
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-[#E8ECF1] text-[11px] text-slate-600 whitespace-nowrap tabular-nums"
                    style={{ fontWeight: 600 }}
                  >
                    {formatQty(takenQty)} {unit} to Return
                  </span>
                </div>
              )}

              {/* The same state chips the serial picker carries, because these
                  are the same units. */}
              {serialized && lotInView && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const counts = stateCounts(lotInView);
                    const total = (unitsByLot.get(lotInView) ?? []).length;
                    return (
                      [
                        { key: null, label: 'All', count: total },
                        { key: 'available' as const, label: 'Available', count: counts.available },
                        { key: 'allocated' as const, label: 'Allocated', count: counts.allocated },
                        {
                          key: 'quarantined' as const,
                          label: 'Quarantined',
                          count: counts.quarantined,
                        },
                        {
                          key: 'checked-out' as const,
                          label: 'Checked out',
                          count: counts['checked-out'],
                        },
                      ] as { key: StockState | null; label: string; count: number }[]
                    ).map((opt) => {
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
                    });
                  })()}
                </div>
              )}

              {/* Why most of a lot's units are shut, in the words the serial
                  picker uses: the two pickers lock for the same reason, so
                  they had better say it the same way. */}
              {lockedVendor &&
                someOpen &&
                (serialized ? lockedOutUnits > 0 : lockedLots.size > 0) && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <Lock className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <p className="min-w-0 flex-1 text-[11px] leading-[1.5] text-amber-900/80">
                    <span className="text-amber-900" style={{ fontWeight: 600 }}>
                      {lockedLots.size} {lockedLots.size === 1 ? 'lot' : 'lots'} from other vendors{' '}
                      {lockedLots.size === 1 ? 'is' : 'are'} locked.
                    </span>{' '}
                    {lockedName
                      ? lockedBy
                        ? `This return goes back to ${lockedName}, ${lockedBy}, so only their lots can be added.`
                        : `You've selected a lot from ${lockedName}, so only their lots can be added.`
                      : "You've selected a lot from one vendor, so only their lots can be added."}
                  </p>
                </div>
              )}

              {/* Select-all above the grid, on what the filters have left in
                  view, exactly as the serial picker carries it. */}
              {serialized && viewTakeable.length > 0 && (
                <button
                  type="button"
                  onClick={toggleViewAll}
                  className="w-full flex items-center gap-2.5 p-2 rounded-md bg-card border border-[#E8ECF1] hover:border-primary/25 transition-colors text-left cursor-pointer"
                >
                  <span
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 ${
                      viewAllOn || viewSomeOn ? 'bg-primary' : 'bg-white border-[1.5px] border-border'
                    }`}
                  >
                    {viewAllOn ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : viewSomeOn ? (
                      <Minus className="w-3 h-3 text-white" />
                    ) : null}
                  </span>
                  <span
                    className="text-[12px] text-foreground"
                    style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                  >
                    {viewAllOn
                      ? `Clear the ${viewChosen.size} selected here`
                      : target === undefined
                        ? `Select all ${viewTakeable.length} selectable ${viewTakeable.length === 1 ? 'unit' : 'units'}`
                        : viewTake.length < wantedHere
                          ? `Select the ${viewTake.length} ${viewTake.length === 1 ? 'unit' : 'units'} this batch can give of the ${wantedHere} wanted`
                          : `Select ${viewTake.length} ${viewTake.length === 1 ? 'unit' : 'units'}, the quantity on this line`}
                  </span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-3">
              {/* One empty state for the panel, not one per list.
                  
                  A query that found nothing was answered twice: the batch list
                  said so, and the unit grid under it said so again in slightly
                  different words. What a dead end needs is one sentence and
                  the way out of it. */}
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
                        No lot, vendor or serial number on {activeLine?.sku ?? 'this item'} matches
                        what you typed.
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
                      {place ? `Nothing held in ${place}` : 'This item has no lots on file'}
                    </span>
                  )}
                </div>
              )}

              {serialized ? (
                /* The serial picker's panel, exactly: the units of the batch
                   in view as one flat grid. The batch is named on its card in
                   the rail, so nothing over the grid repeats it. */
                <>
                  {/* A query answers across the part, so the grid it fills is
                      every batch that has a match in it, each under its own
                      code. Clearing the query puts the batch in view back. */}
                  {search.trim() ? (
                    searchHits.length === 0 ? null : (
                      <div className="flex flex-col gap-4">
                        {searchHits.map(([lot, hits]) => {
                          const block = filtered.find((b) => b.lot === lot);
                          const lotPick = picked.get(lot);
                          const chosen = new Set(lotPick?.serials ?? []);
                          return (
                            <div key={lot}>
                              <div className="mb-2 flex items-center gap-2">
                                <span
                                  className="inline-flex h-5 shrink-0 items-center rounded border border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-700"
                                  style={{ fontWeight: 600 }}
                                >
                                  {lot}
                                </span>
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                  {hits.length} {hits.length === 1 ? 'match' : 'matches'}
                                  {block ? ` · ${lotVendorFor(block)?.vendorName ?? ''}` : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
                                {hits.map((u, i) => (
                                  <UnitCell
                                    key={u.serial}
                                    serial={u.serial}
                                    index={String(i + 1).padStart(3, '0')}
                                    picked={chosen.has(u.serial)}
                                    state={stateOf(u.serial)}
                                    otherVendor={otherVendorUnit(u.serial)}
                                    search={search}
                                    onToggle={() => {
                                      if (!block) return;
                                      setLotUnits(
                                        block,
                                        chosen.has(u.serial)
                                          ? (lotPick?.serials ?? []).filter((sn) => sn !== u.serial)
                                          : [...(lotPick?.serials ?? []), u.serial],
                                      );
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : viewUnits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                      <Search className="w-7 h-7 text-slate-300" />
                      <span className="text-[12px] text-slate-400">
                        No serial numbers in this view
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 items-start sm:grid-cols-2">
                      {viewShown.map((u, i) => (
                        <UnitCell
                          key={u.serial}
                          serial={u.serial}
                          index={String(i + 1).padStart(3, '0')}
                          picked={viewChosen.has(u.serial)}
                          state={stateOf(u.serial)}
                          otherVendor={otherVendorUnit(u.serial)}
                          search={search}
                          onToggle={() => {
                            if (!inViewBlock) return;
                            setLotUnits(
                              inViewBlock,
                              viewChosen.has(u.serial)
                                ? (viewPick?.serials ?? []).filter((sn) => sn !== u.serial)
                                : [...(viewPick?.serials ?? []), u.serial],
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {inViewBlock && viewUnits.length > UNITS_SHOWN && !search.trim() && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenedLots((prev) => {
                          const next = new Set(prev);
                          if (next.has(inViewBlock.lot)) next.delete(inViewBlock.lot);
                          else next.add(inViewBlock.lot);
                          return next;
                        })
                      }
                      className="mt-3 flex w-full items-center justify-center rounded-md border border-[#E8ECF1] bg-white py-2 text-[11px] text-primary transition-colors hover:bg-[#F1F5FA]"
                      style={{ fontWeight: 600 }}
                    >
                      {viewOpened
                        ? 'Show fewer units'
                        : `Show all ${viewUnits.length} units${place ? ` in ${place}` : ''}`}
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  {(filtered.length > 1
                    ? filtered.filter((b) => b.lot === lotInView)
                    : filtered
                  ).map((block) => {
                    const pick = picked.get(block.lot);
                    const held = block.bin;
                    const shut = lotLocked(block.lot);
                    const sp = splitOf(block);
                    return (
                      <div
                        key={block.lot}
                        className={`overflow-hidden rounded-lg border transition-colors ${
                          shut
                            ? 'border-[#EDF1F5] bg-slate-50/60'
                            : pick
                              ? 'border-primary/40 bg-blue-50/40'
                              : 'border-[#E8ECF1] bg-white'
                        }`}
                      >
                        {/* The batch: what it is, when it expires, where it is
                            held, and how much of it is going back. */}
                        <div className="flex items-center gap-2 bg-[#FAFBFC] px-3 py-2">
                          <span
                            className="inline-flex h-5 shrink-0 items-center rounded border border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-700"
                            style={{ fontWeight: 600 }}
                          >
                            LOT
                          </span>
                          <span
                            className={`truncate text-[13px] ${shut ? 'text-slate-400' : 'text-foreground'}`}
                            style={{ fontWeight: 600 }}
                          >
                            {highlightMatch(block.lot, search)}
                          </span>
                          {shut && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] uppercase text-slate-400 whitespace-nowrap"
                              style={{ fontWeight: 600, letterSpacing: '0.05em' }}
                            >
                              <Lock className="w-2.5 h-2.5" />
                              {lotVendorFor(block)?.vendorName ?? 'Other vendor'}
                            </span>
                          )}
                          <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                            expires {formatDate(block.expiry)}
                          </span>
                          <span className="min-w-0 flex-1" />
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {held}
                          </span>
                          {/* What can actually be taken, not what is on the
                              shelf. The field clamps to the free figure, so a
                              row offering the on-hand total was quietly
                              rewriting what people typed against it. */}
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E8ECF1] bg-white px-2 py-0.5 text-[11px] text-slate-600 tabular-nums whitespace-nowrap"
                            style={{ fontWeight: 600 }}
                          >
                            {sp && sp.allocated > 0
                              ? `${formatQty(sp.available)} of ${formatQty(sp.onHand)} ${unit} free`
                              : `${formatQty(block.totalQty)} ${unit} on hand`}
                            {sp && (
                              <AvailableInfo
                                split={sp}
                                uom={unit}
                                title="Free in this lot"
                                scope="in this lot"
                              />
                            )}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <LotQtyInput
                              value={pick?.qty ?? 0}
                              max={sp?.available ?? block.totalQty}
                              unit={unit}
                              disabled={shut}
                              ariaLabel={`Quantity to return from ${block.lot}`}
                              title={
                                shut
                                  ? `This lot is ${lotVendorFor(block)?.vendorName ?? 'another vendor'}, and this return goes back to ${lockedName ?? 'one vendor'}.`
                                  : undefined
                              }
                              onChange={(n) => setLotQty(block, String(n))}
                              className={`w-[76px] h-8 rounded-md border px-2 text-right text-[12px] tabular-nums placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/10 ${
                                shut
                                  ? 'cursor-not-allowed border-[#EDF1F5] bg-slate-50 text-slate-300'
                                  : 'border-[#E8ECF1] bg-white text-foreground focus:border-primary'
                              }`}
                            />
                            <span className="w-6 text-[11px] text-slate-400">{unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* The dialog keeps its footer, where Select Lots lives. The
                panel has none: the rail beside it already says how much of
                the line is picked and the step's own footer says whether the
                step can move on, the same way the serial picker was cut. */}
            <div
              className={`items-center justify-between gap-3 shrink-0 px-5 py-3 border-t border-muted bg-card ${
                inline ? 'hidden' : 'flex'
              }`}
            >
              <div className="min-w-0">
                {target === undefined ? (
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    {formatQty(takenQty)} {unit} across {lotsUsed}{' '}
                    {lotsUsed === 1 ? 'lot' : 'lots'}
                  </span>
                ) : (
                  <>
                    <p className="text-[12px] tabular-nums">
                      <span
                        className={short === 0 ? 'text-emerald-700' : 'text-foreground'}
                        style={{ fontWeight: 700 }}
                      >
                        {formatQty(takenQty)}
                      </span>
                      <span className="text-slate-500" style={{ fontWeight: 500 }}>
                        {' '}
                        of {formatQty(target)} {unit} across {lotsUsed}{' '}
                        {lotsUsed === 1 ? 'lot' : 'lots'}
                      </span>
                    </p>
                    {short !== 0 && (
                      <p className="text-[11px] text-amber-700 mt-px" style={{ fontWeight: 600 }}>
                        {inline
                          ? short > 0
                            ? `${formatQty(short)} ${unit} still to select.`
                            : `${formatQty(-short)} ${unit} more than the ${formatQty(target)} ${unit} on this line. Take some off, or raise the quantity.`
                          : short > 0
                            ? `${formatQty(short)} ${unit} still to select. Save these now and add the rest later.`
                            : `${formatQty(-short)} ${unit} more than the ${formatQty(target)} ${unit} on this line. Confirming returns ${formatQty(takenQty)} ${unit}.`}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
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
                {!inline && (
                  <button
                    type="button"
                    disabled={takenQty === 0}
                    onClick={() => {
                      // Taking more than the line asked for is the picker
                      // saying the line was wrong, so the line follows the
                      // batches. A short pick keeps the count and leaves the
                      // line saying what it still owes.
                      if (short < 0 && onChangeCount) onChangeCount(takenQty);
                      onOpenChange(false);
                    }}
                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12px] hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:opacity-100"
                    style={{ fontWeight: 600 }}
                  >
                    {lotsUsed > 0
                      ? `Select ${lotsUsed} ${lotsUsed === 1 ? 'Lot' : 'Lots'}`
                      : 'Select Lots'}
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
        className="z-[240] !max-w-[1040px] w-full h-[84vh] p-0 gap-0 rounded-2xl border-0 overflow-hidden flex flex-col"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Select lots to return</DialogTitle>
        <DialogDescription className="sr-only">
          Choose which batches this return is sending back, and how much of each.
        </DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
