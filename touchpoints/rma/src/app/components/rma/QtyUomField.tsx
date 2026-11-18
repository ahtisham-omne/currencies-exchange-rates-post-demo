/**
 * How much is going back, and in which unit, as one field.
 *
 * Ported from the qualified-vendor step's price field, which composes the
 * design system's `Input` with `UomPicker variant="embedded"`: the figure on
 * the left, the unit flush against the right edge behind a divider, both
 * inside one bordered box. The picker opens a searchable list grouped into the
 * base unit and its alternatives, each option showing what it is worth beside
 * its name, with a check on the one in force.
 *
 * It replaces a stated unit next to a separate quantity field. That said the
 * unit twice and split one answer across two controls -- the shelf and the
 * figure are the same decision, and a warehouse says it as one thing: twelve
 * pallets.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import { formatQty } from '@/app/components/vendorSelectionModel';
import type { ItemStock } from '@/app/data/itemProvenance';

/** The unit list itself, so anything holding a figure can offer the same
 *  choice: a search, then the part's own unit and whatever else it is held
 *  in, each option carrying what is on that shelf. The band's quantity
 *  control uses it too, and the two must not drift apart. */
export function UomMenu({
  shelves,
  uom,
  onPick,
  onAdd,
  taken = [],
}: {
  shelves: ItemStock[];
  uom: string;
  onPick: (next: string) => void;
  /** Put the part on the return a second time, in this unit, as a line of its
   *  own. A part held as eaches and as boxes may have been bought from two
   *  different suppliers, and one line can only name one of them. Absent where
   *  a second line makes no sense. */
  onAdd?: (next: string) => void;
  /** Units already on the return as their own line. They cannot be switched
   *  into and cannot be added twice: two lines in one unit are one line. */
  taken?: string[];
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? shelves.filter((s) => s.uom.toLowerCase().includes(q)) : shelves;
  }, [query, shelves]);

  return (
    <>
      <div className="shrink-0 border-b border-[#EEF2F6] p-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search units..."
            aria-label="Search units"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Two different acts sit on one row and the plus was labelled "line",
          which names neither of them. Said once at the top, so the rows below
          can stay short. */}
      {onAdd && shown.length > 0 && (
        <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          <span className="text-foreground" style={{ fontWeight: 600 }}>
            Switch unit
          </span>{' '}
          rewrites this line in that unit.{' '}
          <span className="text-foreground" style={{ fontWeight: 600 }}>
            Add line
          </span>{' '}
          keeps this one and returns the same item in a second unit as well.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="px-4 py-5 text-center text-[12px] text-slate-400">
          No unit matches "{query.trim()}".
        </p>
      ) : (
        <div className="max-h-[260px] overflow-y-auto p-1.5">
          {shown.map((s, i) => {
            // The part's own unit first, then whatever else it is held
            // in, each headed so the base one is recognisable as such.
            const group = shelves[0]?.uom === s.uom ? 'Base unit' : 'Alternatives';
            const previous = shown[i - 1];
            const showHeader =
              !previous || (shelves[0]?.uom === previous.uom ? 'Base unit' : 'Alternatives') !== group;
            return (
              <div key={s.uom}>
                {showHeader && (
                  <p
                    className="px-2 pb-1 pt-2 text-[10px] text-slate-500 first:pt-1"
                    style={{ fontWeight: 600 }}
                  >
                    {group}
                  </p>
                )}
                {/* Two actions on one row. The row itself switches the line to
                    that unit, which is what it has always done. The plus puts
                    the part on the return again in that unit, as its own line
                    with its own vendor, because a box supplier is not always
                    the each supplier. */}
                <div
                  className={`flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 transition-colors ${
                    s.uom === uom ? 'bg-blue-50/60' : 'hover:bg-[#F7FAFF]'
                  }`}
                >
                  <span className="inline-flex min-w-0 flex-col">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span
                        className={`text-[12px] ${taken.includes(s.uom) ? 'text-slate-400' : 'text-foreground'}`}
                        style={{ fontWeight: s.uom === uom ? 600 : 500 }}
                      >
                        {s.uom}
                      </span>
                      {s.uom === uom && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary" style={{ fontWeight: 600 }}>
                          <Check className="w-3 h-3" />
                          on this line
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {/* On hand less what is allocated, which is the same
                          arithmetic the line beneath the field states. The
                          menu used to print the raw on-hand figure under the
                          same word, so a part the line called "1798 BOX
                          available" was offered as "2854 available in BOX". */}
                      {taken.includes(s.uom) && s.uom !== uom
                        ? 'already a line on this return'
                        : `${formatQty(s.split.available)} available in ${s.uom}`}
                    </span>
                  </span>
                  {/* Two acts, both spelled out. The row used to be the switch
                      and a plus beside it the second line, which named neither
                      and made the commoner of the two the one you could hit by
                      accident. */}
                  <span className="flex shrink-0 items-center gap-1">
                    {s.uom !== uom && !taken.includes(s.uom) && (
                      <button
                        type="button"
                        onClick={() => { onPick(s.uom); }}
                        aria-label={`Switch this line to ${s.uom}`}
                        title={`Rewrites this line in ${s.uom}. ${formatQty(s.split.available)} available.`}
                        className="inline-flex h-6 items-center rounded border border-[#E2E8F0] bg-white px-2 text-[10px] text-slate-600 whitespace-nowrap transition-colors hover:border-primary/30 hover:text-foreground"
                        style={{ fontWeight: 600 }}
                      >
                        Switch unit
                      </button>
                    )}
                    {onAdd && s.uom !== uom && !taken.includes(s.uom) && (
                      <button
                        type="button"
                        onClick={() => { onAdd(s.uom); }}
                        aria-label={`Add a second line for this item in ${s.uom}`}
                        title={`Keeps this line as it is and adds a second line in ${s.uom}, with its own quantity and its own vendor.`}
                        className="inline-flex h-6 items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 text-[10px] text-primary whitespace-nowrap transition-colors hover:bg-blue-100"
                        style={{ fontWeight: 600 }}
                      >
                        <Plus className="w-3 h-3" />
                        Add line
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * A refusal that stays up long enough to be read.
 *
 * A keystroke the field turns down has to say why, and saying it only while
 * the key is down says nothing: typing 2.5 flashed the reason for the length
 * of one keypress and then the 5 arrived and cleared it. So the notice is
 * raised by the refusal and taken down on a timer, not by the next thing the
 * user types.
 */
/** What a quantity box lets through as it is typed: digits, optionally a
 *  decimal point and up to two places. Anything else is not a number anybody
 *  meant to enter. */
export const QTY_DRAFT = /^\d*(?:\.\d{0,2})?$/;

/** A fraction standing in a box that only counts whole units.
 *
 *  Every quantity on a return is whole, whatever the part is tracked by: goods
 *  go back in units, not in halves of one. The rule used to depend on tracking,
 *  which let an untracked line take 2.5 and a serialized one refuse it.
 *
 *  Refusing the decimal point outright is what turned 2.5 into 25: the point
 *  was dropped, the field redrew as "2", and the 5 arrived behind it. The
 *  fraction is let in and marked wrong instead, so the figure on screen is
 *  always the figure that was typed. */
export const isFractional = (draft: string) => draft.includes('.');

export function useRefusalNotice(holdMs = 3200): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const raise = () => {
    setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), holdMs);
  };
  return [shown, raise];
}

export function QtyUomField({
  id,
  value,
  uom,
  shelves,
  invalid,
  ariaLabel,
  onValue,
  onUom,
  onAddUnit,
  taken,
}: {
  id: string;
  value: string;
  uom: string;
  /** Every unit the part is held in, with what is on hand in each. */
  shelves: ItemStock[];
  invalid: boolean;
  ariaLabel: string;
  /** Serialized stock cannot come back in fractions of a unit. */
  onValue: (next: string) => void;
  onUom: (next: string) => void;
  /** Put the part on the return again in another unit, as its own line. */
  onAddUnit?: ((next: string) => void) | undefined;
  /** Units already on the return as their own line. */
  taken?: string[] | undefined;
}) {
  const [open, setOpen] = useState(false);

  const only = shelves.length <= 1;

  return (
    // The composite field's own frame carries the border and the focus ring;
    // the control and the unit sit inside it with no borders of their own, so
    // the two read as one field rather than two stuck together.
    // A fixed width, and the unit segment fixed inside it, so every row's field
    // is the same size. Sizing it to its contents made a serialized row's field
    // visibly narrower than the one above it -- the same control, drawn two
    // ways, because one of them had no chevron.
    <div
      className={`flex w-[124px] items-stretch overflow-clip rounded-lg border transition-[border-color,box-shadow] duration-150 ${
        invalid
          ? 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100'
          : 'border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10'
      }`}
    >
      <input
        id={id}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={`h-8 min-w-0 flex-1 bg-white px-2.5 text-right text-[13px] leading-5 tabular-nums outline-none ${
          invalid ? 'text-red-700' : 'text-foreground'
        }`}
        style={{ fontWeight: 600 }}
      />

      {only ? (
        // Nothing to choose. The unit still belongs in the field rather than
        // beside it, so it keeps the same slot and loses only the chevron.
        <span className="flex h-8 w-[52px] shrink-0 items-center border-l border-slate-200 bg-[#FAFBFC] px-2.5 text-[12px] text-slate-500">
          {uom}
        </span>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          {/* What else this part is held in, on hover.
              
              The chevron said a list existed and nothing said what was in it,
              so a part held in boxes and in eaches read as a part held in one
              unit with a control nobody had reason to press. */}
          {/* Asked for rather than tripped over: the field is passed through
              on the way to the quantity, so the unit list waits. */}
          <HoverCard openDelay={400} closeDelay={120}>
            <HoverCardTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Unit of measure for ${ariaLabel}`}
                  className="flex h-8 w-[52px] shrink-0 items-center justify-between gap-1 border-l border-slate-200 bg-[#FAFBFC] px-2 text-[12px] text-foreground outline-none transition-colors hover:bg-slate-100"
                  style={{ fontWeight: 500 }}
                >
                  {uom}
                  <ChevronDown className="w-3 h-3 shrink-0 text-slate-400" />
                </button>
              </PopoverTrigger>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="end" sideOffset={8} className="w-[260px] p-0 z-[280]">
              <p className="border-b border-border px-3 py-2 text-[11px] text-slate-500">
                Held in {shelves.length} {shelves.length === 1 ? 'unit' : 'units'}. Click to switch
                this line, or to add a second one.
              </p>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                {shelves.map((sh) => (
                  <div key={sh.uom} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className={sh.uom === uom ? 'text-foreground' : 'text-slate-500'} style={{ fontWeight: sh.uom === uom ? 600 : 400 }}>
                      {sh.uom}
                      {sh.uom === uom ? ' · on this line' : ''}
                    </span>
                    <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                      {formatQty(sh.qty)}
                    </span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[310px] p-0 rounded-xl border border-[#E2E8F0] overflow-hidden z-[260] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
          >
            <UomMenu
              shelves={shelves}
              uom={uom}
              taken={taken ?? []}
              onPick={(next) => { onUom(next); setOpen(false); }}
              {...(onAddUnit ? { onAdd: (next: string) => { onAddUnit(next); setOpen(false); } } : {})}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
