/**
 * Configure Items, as the return's one step.
 *
 * This is the real cycle count planner's second step, brought over whole:
 * `render-companion/src/app/components/create-cycle-count.tsx`, the block
 * behind `modalStep === 2`. Its shape, top to bottom:
 *
 *   Add … to Count card -- icon circle, heading, one line of help, Learn More;
 *     then a search bar that is always visible, carrying a "N added" pill and
 *     an `esc` key hint, and opening a grouped results dropdown on focus with
 *     a separate round + target on each row for adding without closing it.
 *
 *   Two-panel master-detail -- a 300px rail of what has been added, each row
 *     a 36px tile with the code over its description, a tracking chip and a
 *     remove button that appears on hover, and a `+ Add Items` link at the
 *     end; then the detail, which is a search bar at half width over a table.
 *
 *   The table -- a 44px "Count all …" row above the column headers, which
 *     hides every row checkbox while it is on; a 40px header naming the row
 *     type with a count chip beside it, then the figures; 56px rows.
 *
 * The planner's step is two steps here, and that is the whole reason to bring
 * it over: it selects and configures on one screen, where this flow searched
 * on one and resolved on another. The rail is the list the search fills, and
 * the table is what used to be a second step.
 *
 * What the columns hold is the one place this departs, and it departs the way
 * the planner's own serialized rows already do. A count has `System Count`,
 * what is on the shelf, and -- for serialized items only, the one case where
 * a count can be partial -- `Units to Count` beside it. A return is partial in
 * every tracking mode, so `To return` is there for all of them, and it is
 * the only cell anybody types in. The line's quantity is what those cells add
 * up to, so it is never asked for twice.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { otherCurrencyReason, poCurrency } from '@/app/currency/returnCurrency';
import { isLotMode,
  hasSerials,
  trackingModeFor,
} from '@/app/data/mockRMAs';
import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  GitMerge,
  Hash,
  Info,
  Layers,
  Lock,
  Link2Off,
  ListChecks,
  MapPin,
  Package,
  PackageSearch,
  Plus,
  ScanLine,
  Search,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { AvailableInfo } from '@/app/components/rma/AvailableInfo';
import { QtyUomField, QTY_DRAFT, isFractional, useRefusalNotice } from '@/app/components/rma/QtyUomField';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/lib/itemImages';
import { highlight } from '@/app/components/rma/ItemResultRow';
import {
  ItemDescriptionWithToggle,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { formatDate, formatQty } from '@/app/components/vendorSelectionModel';
import { VendorDescription } from '@/app/components/rma/VendorDescription';
import { vendorAddress, mockVendors } from '@/app/data/mockVendors';
import { ReceivingDocumentModal } from '@/app/components/invoice-details/ReceivingDocumentModal';
import { VendorQuickCard } from '@/app/components/InvoiceDataTable';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import {
  TRACKING_CHIP,
  TRACKING_LABELS,
  type ItemStock,
  type ReturnableItem,
  type TrackingMode,
  itemSearchText,
} from '@/app/data/itemProvenance';

/** One delivery of the focused part: a row in the detail table. */
export interface DeliveryRow {
  grnNumber: string;
  poNumber: string;
  date: string;
  vendorCode: string;
  vendorName: string;
  /** What the delivery brought in. The planner's `System Count`. */
  received: number;
  /** How much of it is going back. Zero means the row is not in use. */
  coming: number;
  /** Serialized only: how many units this delivery could supply. */
  units?: number | undefined;
  /** The vendor site the goods physically came from. */
  originName?: string | undefined;
  /** That site's id, which is what a shipment back is grouped by. */
  originId?: string | undefined;
}

/** A vendor who has shipped this part: a candidate for a counted return. */
export interface VendorOption {
  vendorCode: string;
  /** The company behind the branch, where the master carries one. Two
   *  candidates sharing it are the pair a return can be merged onto. */
  familyCode?: string | undefined;
  vendorName: string;
  /** Everything they ever shipped of it, less what has gone back. */
  lifetime: number;
  /** And what they shipped in the last thirty days, which is the better guess. */
  recent: number;
}

/** One part on the return: a row in the rail. */
export interface RailLine {
  /** Part and unit. A part on the return in two units is two rows, and each
   *  one holds its own vendor, its own receipts and its own resolution. */
  key: string;
  sku: string;
  description: string;
  uom: string;
  trackingMode: TrackingMode;
  qty: number;
}

/** What a line still has to settle with the vendor the return is with. */
export type LineVendorNote =
  /** Controlled stock whose every unit traces away from the locked vendor.
   *  There is no answer to offer: the line comes off, or it goes back on an
   *  RMA of its own. */
  | { kind: 'blocked'; owners: string[]; lockName: string }
  /** Plain stock the user pointed at somebody else before a serial or a lot
   *  named the return's vendor. One return goes back to one vendor, so this
   *  is a choice to remake rather than an error to refuse. */
  | { kind: 'switch'; lockName: string; currentName: string; onSwitch: () => void }
  /** Plain stock the locked vendor has no receipt for. One bolt is any bolt,
   *  so it can still go back to them, but nothing on file says it was
   *  theirs, so it is asked rather than assumed. */
  | {
      kind: 'unshipped';
      lockName: string;
      /** Why the return is with them, in the words the header uses. */
      lockReason?: string | undefined;
      onUse: () => void;
    }
  /** The line is asking for more than the locked vendor ever sent. The
   *  quantity was typed on the first step, before anybody knew who the
   *  return was with, so no amount of picking can close it: the units are
   *  not there. The figure comes down, or the item comes off. */
  | {
      kind: 'shortfall';
      lockName: string;
      cap: number;
      declared: number;
      uom: string;
      onFix: () => void;
    };

/**
 * A lot-tracked line, on the step that asks which batches are coming back.
 *
 * The serialized card's shape, because it is the same shape of answer: a
 * figure on the rail, a picker behind one button, and a running count of how
 * much of that figure the picks cover. What differs is only what a pick is --
 * a batch and a quantity off it, rather than a unit that is either going back
 * or not.
 */
function LotStage({
  line,
  cap,
  lotQty,
  onOpenLots,
}: {
  line: RailLine;
  cap: number;
  lotQty: number;
  onOpenLots: () => void;
}) {
  const short = Math.round((line.qty - lotQty) * 100) / 100;

  return (
    <Stage
      icon={<Layers className="w-3 h-3" />}
      title={
        line.trackingMode === 'lot-serialized'
          ? 'Select lots and serial numbers to return'
          : 'Select lots to return'
      }
      hint={
        line.qty <= 0
          ? 'Enter a quantity on the item first, then select the lots it comes off.'
          : short === 0
            ? line.trackingMode === 'lot-serialized'
              ? 'Every unit is selected, in its lot and on the document it arrived on.'
              : 'Every unit is assigned to a lot.'
            : short > 0
              ? `${formatQty(short)} ${line.uom} is not assigned to a lot yet.`
              : `${formatQty(-short)} ${line.uom} more is assigned than the quantity to return.`
      }
      figure={line.qty > 0 ? `${formatQty(lotQty)} of ${formatQty(line.qty)} on a batch` : undefined}
      tone={line.qty > 0 && short === 0 ? 'done' : lotQty > 0 || line.qty > 0 ? 'warn' : 'todo'}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="min-w-0 text-[12px] text-slate-500">
          {lotQty > 0
            ? 'Each lot carries its own expiry and its own receipt, so the credit follows the lots you select.'
            : line.trackingMode === 'lot-serialized'
              ? `${formatQty(cap)} ${line.uom} is on hand, held in lots with numbered units inside them. Select a lot, then select its serial numbers.`
              : `${formatQty(cap)} ${line.uom} is on hand, held in lots. Enter the quantity to return from each lot.`}
        </p>
        <button
          type="button"
          onClick={onOpenLots}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] text-white whitespace-nowrap shadow-sm transition-colors hover:bg-blue-700"
          style={{ fontWeight: 600 }}
        >
          <Layers className="w-3.5 h-3.5" />
          {line.trackingMode === 'lot-serialized' ? 'Select lots and units' : 'Select lots'}
        </button>
      </div>
    </Stage>
  );
}

/** The stepper's line-level questions, in the order they are asked. */
/** Which question a render of the panel is answering. `items` is the rail on
 *  its own, carrying the search, the remove and the figures: what is coming
 *  back and how much of it is one question and one screen. The other three put
 *  the rail beside the panel that answers one question about the focused
 *  line. */
export type ConfigureStage = 'items' | 'units' | 'vendor' | 'receivers';

export function ReturnConfigureItems({
  stage = 'items',
  query,
  onQuery,
  catalogue,
  lines,
  focused,
  onFocus,
  deliveries,
  onAdd,
  onRemove,
  onRowQty,
  onAllRows,
  onOpenUnits,
  onOpenLots,
  onOpenLine,
  cap,
  named,
  lotQty,
  onDeclare,
  onDeclareFor,
  shelves,
  onUom,
  onUomFor,
  onAddUnit,
  volumeUom,
  unitsReceived,
  familyOnReturn,
  lockedVendor,
  lockedVendorName,
  lockedVendorAddress,
  lockedVendorNote,
  vendors,
  chosenVendor,
  docsForVendor,
  untied,
  merge,
  onPickVendor,
  onCreateVendor,
  onUntied,
  onMerge,
  answeredNote,
  unitPicker,
  lotPicker,
  vendorPicker,
  showErrors = false,
  pendingKeys = [],
  rowStatus,
  conflict,
  onOpenPO,
  currencyLock,
}: {
  /** Which of the stepper's questions this render is answering. The component
   *  holds all three panels; the step decides which one is on screen. Splitting
   *  the render rather than the state is deliberate: the focus, the ties and
   *  the merge are one line's answer read several ways, and pulling them apart
   *  into separate components would have meant several copies of it. */
  stage?: ConfigureStage;
  query: string;
  onQuery: (next: string) => void;
  /** Everything that can come back, for the dropdown. */
  catalogue: ReturnableItem[];
  /** What is on the return, in rail order. */
  lines: RailLine[];
  focused: string | null;
  onFocus: (sku: string) => void;
  /** The focused part's deliveries. */
  deliveries: DeliveryRow[];
  onAdd: (sku: string) => void;
  onRemove: (sku: string) => void;
  /** How much comes off one delivery. Zero takes the row out of use. */
  onRowQty: (grnNumber: string, qty: number) => void;
  /** The "Count all" row: every delivery, or none. */
  onAllRows: (on: boolean) => void;
  /** Serialized only: name the units on one delivery. */
  onOpenUnits: (grnNumber: string) => void;
  /** Lot-tracked only: open the batch picker for the focused line. */
  onOpenLots: () => void;
  /** The rest of the line: reason, remedy, notes, files. */
  onOpenLine: (sku: string) => void;
  /** Everything received of the focused part: the ceiling on the count. */
  cap: number;
  /** How many units of it have actually been named. */
  named: number;
  /** Lot-tracked only: how much of the focused line has been taken off named
   *  batches. The lot equivalent of `named`. */
  lotQty: number;
  /** What the user says is coming back, before any unit is named. */
  onDeclare: (qty: number) => void;
  /** The same write, by part. The quantity step puts a field on every row at
   *  once, and every step after it keeps one on the row in focus, so a figure
   *  is never a step you have to go back to. */
  onDeclareFor: (sku: string, uom: string, qty: number) => void;
  onUomFor: (sku: string, from: string, to: string) => void;
  /** Put a part on the return a second time, in another unit, as its own line.
   *  A part held as eaches and as boxes can have been bought from two
   *  different suppliers, and one line can only name one of them. */
  onAddUnit: (sku: string, uom: string) => void;
  /** What a line the step does not ask about already says. Shown beside it in
   *  the settled group, so a line that is off this screen reads as answered
   *  rather than as missing: the vendor a serial traced to, for instance. */
  answeredNote?: ((line: RailLine) => string | null) | undefined;
  /** The serial picker, drawn on the units step instead of behind a button. */
  unitPicker?: React.ReactNode;
  /** The lot picker, drawn the same way and for the same reason: the panel
   *  has the room, and a dialog over an empty panel is two clicks around a
   *  list. LOT Serialized opens its units inside it, under the document row
   *  they belong to. */
  lotPicker?: React.ReactNode;
  /** The vendor card for a line with nothing to name: plain stock, which has
   *  no units and no batches, only a supplier to choose. */
  vendorPicker?: React.ReactNode;
  /** Every unit the focused part is held in, for the band's unit picker. */
  shelves: ItemStock[];
  /** Rewrite the line on a different shelf. Not an edit to the figure: what is
   *  on hand, what the ceiling is and which deliveries exist all change. */
  onUom: (uom: string) => void;
  /** The unit the part is received in, which is the unit its vendors' volumes
   *  are counted in. The same as the line's unit until somebody writes the
   *  line on a different shelf. */
  volumeUom: string;
  /** Which units this part has actually been received in, and how much of
   *  each. A line written in a unit nothing ever arrived in has no document
   *  to tie, and the only way out of that is to write the line in a unit that
   *  exists -- so the screen has to be able to say which those are. */
  unitsReceived: (vendorCode: string | null) => { uom: string; qty: number; docs: number }[];
  /** The company a candidate belongs to, when another line of this return is
   *  already going back to one of its branches. Naming that on the row turns
   *  the second step's merge question from a surprise into a choice. */
  familyOnReturn: (vendorCode: string) => string | null;
  /** Named before anything was picked, on the by-vendor route. The candidate
   *  list is not a question then, so the tab does not ask one. */
  lockedVendor: string | null;
  /** Their name, for the band over the step. */
  lockedVendorName: string | null;
  /** Their primary address, so the header names a place as well as a company:
   *  two branches of one supplier read identically without it. */
  lockedVendorAddress?: string | null;
  /** What named them. A vendor that appears without a reason reads as one the
   *  flow chose rather than one the units did. */
  lockedVendorNote?: string | null;
  /** Counted only: everyone who has shipped the focused part. */
  vendors: VendorOption[];
  /** Counted only: the one vendor taking it back. */
  chosenVendor: string | null;
  /** Counted only: every delivery of the focused part from one vendor, which
   *  is what a vendor row opens onto. */
  docsForVendor: (vendorCode: string) => DeliveryRow[];
  untied: boolean;
  /** One RMA for the vendor, or one per site they shipped from. */
  merge: boolean;
  onPickVendor: (vendorCode: string) => void;
  /** Opens partner creation. A vendor the master does not carry is a record
   *  that has to be made there, not a name typed onto this return. */
  onCreateVendor: () => void;
  onUntied: (next: boolean) => void;
  onMerge: (next: boolean) => void;
  /** Only true once Continue has been pressed. A part added a second ago and
   *  not yet counted is not a mistake, so nothing is flagged until leaving
   *  the step is the thing being asked for. */
  showErrors?: boolean;
  /** The keys of the lines this step is still waiting on, in the step's own
   *  terms: no units named, or no vendor picked. The rail marks them, and
   *  the mark goes when the line is answered. */
  pendingKeys?: string[];
  /** What to say about a line on this step, if anything. `todo` is
   *  outstanding, `auto` is answered by the flow rather than by the user, and
   *  `done` is answered. */
  rowStatus?: (line: RailLine) => { label: string; tone: 'todo' | 'auto' | 'done'; title?: string } | null;
  /** What this line has to settle with the vendor the return is with, if
   *  anything. Not a split and never a second draft: the return is with one
   *  vendor, so the line is moved onto them or comes off, and which of those
   *  it is belongs to the user.
   *
   *  `blocked` is a controlled line whose whole provenance leads elsewhere.
   *  `switch` is a plain line pointed at somebody else, which is a choice
   *  the user made and can remake. `unshipped` is a plain line the locked
   *  vendor has no receipt for, which is answerable but not assumable. */
  conflict?: (line: RailLine) => LineVendorNote | null;
  /** Open a purchase order in the ordering module. */
  onOpenPO?: ((poNumber: string) => void) | undefined;
  /** The currency a vendor's return is already in: the PO currency of a
   *  receipt picked for it. A receipt from a PO in another currency can't
   *  join; it goes on a separate return (app/currency/returnCurrency.ts). */
  currencyLock?: ((vendorCode: string) => string | null) | undefined;
}) {
  // The first step is the rail on its own: search into it, add, type the
  // figure. From the second the rail narrows and the panel beside it answers
  // one question about the line in focus.
  const railOnly = stage === 'items';

  /** Whether this step has a question for this line.
   *
   *  Naming units is a question for tracked stock and nobody else. Choosing a
   *  vendor and choosing a receipt are both questions for stock that cannot
   *  name its own: a serial carries the document it arrived on and the
   *  supplier who sent it, so naming the units on the step before answered
   *  both. A line the step does not ask about is not outstanding, it is
   *  settled by another route, and the rail says which rather than listing it
   *  as though it were waiting on an answer. */
  const asksAbout = (l: RailLine) => {
    // The first step asks every line for a figure, serialized included.
    if (railOnly) return true;
    // And the units step asks every line too, now that it carries the vendor:
    // plain stock has no units to name, but it still has to say whose it is.
    if (stage === 'units') return true;
    // Anything numbered is settled by its numbers, whether the numbers sit in
    // a batch or on their own: naming the units named the vendor and named the
    // document, so neither step asks again.
    return !hasSerials(l.trackingMode);
  };
  /** The line the trash can was pressed on, waiting on an answer. Taking a
   *  part off is one click on a row somebody is reading rather than editing,
   *  and it takes its figure, its units, its vendor and its ties with it. */
  const [removing, setRemoving] = useState<RailLine | null>(null);

  /** Waiting on an answer, and only where there is one to give: the units
   *  step and the vendor step ask line by line, and a line the step does not
   *  ask about is settled rather than outstanding. */
  const pending = (l: RailLine) =>
    (stage === 'units' || stage === 'vendor') && asksAbout(l) && pendingKeys.includes(l.key);

  const asked = lines.filter(asksAbout);
  const settled = lines.filter((l) => !asksAbout(l));
  /** The group is one kind of stock by construction: the units step settles
   *  plain stock, and the two steps after it settle serials. So the footer
   *  names it with the chip a row already wears rather than inventing a
   *  phrase for it. */
  /** What the settled group is, when it is one thing. The units step settles
   *  plain stock; the two after it settle everything numbered, which is
   *  serialized parts and lot-serialized parts together. */
  const settledKinds = [...new Set(settled.map((l) => l.trackingMode))];
  const settledKind: TrackingMode =
    settledKinds.length === 1 ? settledKinds[0]! : stage === 'units' ? 'none' : 'serialized';
  const settledWhy =
    stage === 'units'
      ? 'No serial numbers or lots to select'
      : stage === 'receivers'
        ? 'Their serial numbers name the receipt'
        : 'Their serial numbers name the vendor';

  /** Select a row and put the cursor where the row is asking to be answered.
   *
   *  Pressing a card is pressing its quantity field: the figure is what the
   *  card is for, and reaching the row and then reaching the field inside it
   *  were two gestures for one intention. The field is mounted on the first
   *  step and mounted on focus after it, so the focus waits a frame for the
   *  rows that grow one. */
  const focusQty = (key: string) => {
    const el = document.getElementById(`qty-${key}`);
    if (el instanceof HTMLInputElement) { el.focus(); el.select(); }
  };
  const focusRow = (key: string) => {
    onFocus(key);
    requestAnimationFrame(() => focusQty(key));
  };


  /** One rail row. Both groups draw the same row; the settled group draws it
   *  dimmed, because it is a statement rather than a question. */
  const renderRow = (l: RailLine, settled = false) => {
                const active = l.key === line?.key;
                // Outstanding is a property of the whole card, not a label on
                // it: the card is stroked in amber until the line has what
                // this step wants. An amber word beside a part number read as
                // an error on the part.
                const status = rowStatus?.(l) ?? null;
                const waiting = status?.tone === 'todo';
                // Answered, and saying so. A card that had been dealt with
                // looked exactly like one nobody had touched, so the only way
                // to check your own work was to open every line again.
                const answered = status?.tone === 'done' || status?.tone === 'auto';
                return (
                  <div key={l.key} className="group relative px-2 py-1">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => focusRow(l.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          focusRow(l.key);
                        }
                      }}
                      aria-current={active}
                      aria-label={`Open ${l.sku} in ${l.uom}`}
                      className={`relative flex w-full cursor-pointer flex-col rounded-lg py-3 pl-3 pr-2.5 text-left transition-colors ${
                        active
                          ? 'bg-blue-50 ring-1 ring-blue-200'
                          : waiting
                            ? 'bg-amber-50/30 ring-1 ring-amber-200/80 hover:bg-amber-50/60'
                            : answered
                              ? 'bg-slate-50/70 ring-1 ring-inset ring-[#EDF1F5] hover:bg-slate-50'
                              : 'hover:bg-slate-50'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
                      )}
                      {/* The row itself. What the line has to declare about
                          its stock goes under it, across the whole card,
                          where a sentence has room to be a sentence. */}
                      <div className="flex w-full flex-wrap items-start gap-x-3 gap-y-2">
                      <span
                        className="w-14 h-14 shrink-0 overflow-hidden rounded-md border border-[#E8ECF1]"
                      >
                        <ImageWithFallback
                          src={imageForSku(l.sku)}
                          alt={l.sku}
                          className="w-full h-full object-cover"
                        />
                      </span>
                      <span className="min-w-[150px] flex-1 basis-[150px]">
                        {/* The tracking chip sits beside the part number, not
                            on a line of its own under the description. It is a
                            property of the part, it reads as one where the part
                            names itself, and it gives the row back a line. */}
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={`min-w-0 truncate text-[13px] ${active ? 'text-primary' : 'text-foreground'}`}
                            style={{ fontWeight: 600 }}
                          >
                            {l.sku}
                          </span>
                          <TrackingTag mode={l.trackingMode} />
                          {/* Not on the row in focus: the panel beside it is
                              already showing the answer, and the chip was
                              squeezing the part number out of a card that also
                              carries the quantity field. */}
                          {answered && !active && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-1.5 py-[1px] text-[10px] text-emerald-700 ring-1 ring-inset ring-emerald-200/70"
                              style={{ fontWeight: 600 }}
                              title={status?.title ?? 'Answered'}
                            >
                              <Check className="w-2.5 h-2.5" />
                              {status?.label || 'Done'}
                            </span>
                          )}
                        </span>
                        <ItemDescriptionWithToggle
                          description={longDescriptionFor(l.sku, l.description)}
                          highlightText={highlight}
                          itemSearch=""
                          widthClass="w-full"
                          hugText
                          textClass="text-[11px]"
                        />

                      </span>

                      {/* In front of the item rather than under it: the part
                          names itself on the left, the figure is asked on the
                          right, and what it is measured against sits under the
                          field it belongs to. */}
                      {/* On the first step every row carries one, so a part is
                          added and its figure typed in the same gesture and
                          the list goes down in a single pass. After that the
                          row in focus keeps its field, because a figure you
                          can only change by walking back to the first step is
                          a figure the flow is hiding from you. */}
                      {(stage === 'items' || active) && (
                        <span
                          className="flex shrink-0 flex-col items-end gap-1.5"
                          // Pressing the field is pressing the row, but only
                          // as far as selecting it.
                          //
                          // The click used to travel on to the row's own
                          // handler, which puts the cursor in the quantity
                          // input a frame later. That is right when the row
                          // was pressed and wrong when the unit picker was:
                          // the focus landed outside the open menu and shut
                          // it, so the unit list appeared and vanished in the
                          // same blink.
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocus(l.key);
                          }}
                        >
                          {/* The same field whatever the part is tracked
                              by. "It doesn't matter whether it's serialized,
                              lot control, nothing. I just put in the number."
                              Which units they are is answered on the right. */}
                          <RailQtyField
                            line={l}
                            cap={capFor(l)}
                            shelves={stockFor(l.sku)}
                            missing={showErrors && l.qty <= 0}
                            onDeclare={(qty) => onDeclareFor(l.sku, l.uom, qty)}
                            onUom={(uom) => onUomFor(l.sku, l.uom, uom)}
                            onAddUnit={(uom) => onAddUnit(l.sku, uom)}
                            taken={lines
                              .filter((other) => other.sku === l.sku)
                              .map((other) => other.uom)}
                          />
                          {/* What the figure is measured against, under the
                              field it belongs to -- and, once Continue has
                              asked, what is wrong with it instead. The ceiling
                              is context for a figure; there is no figure yet,
                              so the slot says the thing that matters. */}
                          {/* No sentence here any more. Every line was
                              carrying its own copy of the same warning, which
                              is the thing the issues strip at the top of the
                              screen now says once. The field still turns red,
                              so a line reached from that strip says which it
                              is. */}
                          {showErrors && l.qty <= 0 ? (
                            <span
                              className="flex items-center gap-1 text-[11px] text-red-700 whitespace-nowrap"
                              style={{ fontWeight: 600 }}
                            >
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              No quantity
                            </span>
                          ) : (
                            (() => {
                              const sp = splitFor(l);
                              if (!sp) return null;
                              // Available to return is on hand less allocated,
                              // and nothing else. Quarantined and checked-out
                              // stock is inside that figure: it goes back, it
                              // just says so when it is picked. Allocated is
                              // the only subtraction, so it is the only one
                              // the line states, and the sum behind it opens
                              // on hover rather than sitting on the card.
                              return (
                                <span className="inline-flex items-center gap-1 text-[11px] tabular-nums whitespace-nowrap text-slate-500">
                                  <span className="text-foreground" style={{ fontWeight: 600 }}>
                                    {formatQty(sp.available)} {l.uom}
                                  </span>{' '}
                                  available
                                  <AvailableInfo split={sp} uom={l.uom} units={stockFor(l.sku)} />
                                </span>
                              );
                            })()
                          )}
                        </span>
                      )}
                      <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoving(l);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setRemoving(l);
                            }
                          }}
                          aria-label={`Remove ${l.sku} in ${l.uom} from this return`}
                          title="Remove item from this return"
                          className="flex w-6 h-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </span>
                      </div>

                      </div>
                  </div>
                );
  };

  // Every row is asked at once on the quantity step, so each one needs its own
  // shelf and its own ceiling rather than the focused line's.
  const stockFor = (sku: string) => catalogue.find((i) => i.sku === sku)?.stock ?? [];
  const shelfFor = (sku: string, uom: string) => stockFor(sku).find((sh) => sh.uom === uom);
  /** What can actually go back. On hand less what is allocated: allocated
   *  stock is committed to a job or a sales order, and releasing it is the
   *  allocation engine's decision rather than a return's. */
  const capFor = (l: RailLine) => shelfFor(l.sku, l.uom)?.split.available ?? 0;
  const splitFor = (l: RailLine) => shelfFor(l.sku, l.uom)?.split;
  const [searchOpen, setSearchOpen] = useState(false);
  /** Focus, separately from whether the dropdown is showing. They came apart
   *  when a part was added: the list closes, the field keeps focus. */
  const [searchFocused, setSearchFocused] = useState(false);
  const [detailQuery, setDetailQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /** Dismissed by clicking away, not by a sheet laid over the page. The round
   *  + target adds without closing, so a scrim across the viewport left the
   *  table beneath it untouchable for as long as the dropdown stood. */
  useEffect(() => {
    if (!searchOpen) return;
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [searchOpen]);

  const on = useMemo(() => new Set(lines.map((l) => l.sku)), [lines]);
  // By key, not by part. Matching on the part number opened the first line of
  // a part whichever of its units was clicked, so a helmet on the return in
  // eaches and in boxes had one of them permanently unreachable.
  const line = lines.find((l) => l.key === focused) ?? lines[0];

  /** The card in focus owns the cursor.
   *
   *  A card turns blue the moment it is added or pressed, and the only thing
   *  it is waiting for is a figure, so the figure is where the cursor goes --
   *  whichever way the card got there. Adding a part used to leave the caret
   *  in the search field, which meant the part that had just appeared, lit up
   *  and asking for a number, was the one place typing did not go. Only on the
   *  first step: after it, the steps move the focus themselves as answers land
   *  and taking the cursor with it would fight them. */
  const activeKey = railOnly ? (line?.key ?? null) : null;
  useEffect(() => {
    if (!activeKey) return;
    const frame = requestAnimationFrame(() => focusQty(activeKey));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);
  const conflictNote = line ? conflict?.(line) ?? null : null;
  const serialized = line?.trackingMode === 'serialized';

  /** Arrive on a step with one of its own lines open.
   *
   *  Focus follows whatever was last opened, and the last thing opened is
   *  often a line this step has nothing to ask: a serialized part when the
   *  step is the vendor, plain stock when the step is the units. The panel
   *  then opened on a statement with no row lit in the rail, so a step that
   *  had a question ready looked like it was waiting to be clicked first.
   *
   *  Only where the step starts. A settled row is still clickable, and having
   *  clicked one it stays open. */
  useEffect(() => {
    if (railOnly) return;
    if (line && asksAbout(line)) return;
    const first = asked[0];
    if (first) onFocus(first.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, asked.length]);

  /** The dropdown's rows. With nothing typed the planner shows the five most
   *  recently counted; the same reading here is the five most recently
   *  received, which is what a return is most often of. */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...catalogue]
        .filter((i) => i.lastReceivedDate)
        .sort((a, b) => b.lastReceivedDate.localeCompare(a.lastReceivedDate))
        .slice(0, 5);
    }
    // The part number, what it is, and what it is controlled by: the same
    // haystack every other item search in the flow reads, so "serialized"
    // and "lot" find what their chips say they are.
    const words = q.split(/\s+/);
    return catalogue
      .filter((i) => {
        const hay = itemSearchText(i);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 40);
  }, [catalogue, query]);

  const visible = useMemo(() => {
    const q = detailQuery.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter(
      (d) =>
        d.grnNumber.toLowerCase().includes(q) ||
        d.poNumber.toLowerCase().includes(q) ||
        d.vendorName.toLowerCase().includes(q),
    );
  }, [deliveries, detailQuery]);

  const allOn = deliveries.length > 0 && deliveries.every((d) => d.coming > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Taking a part off the return, asked before it happens. The trash can
          sits on a row the user is reading, one step away from the figure they
          just typed, and what it discards is everything answered about that
          part on every step after this one. */}
      {removing && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pt-6">
              <span className="mb-4 flex w-11 h-11 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="w-5 h-5 text-red-600" />
              </span>
              <h3 className="text-lg text-foreground" style={{ fontWeight: 700 }}>
                Remove {removing.sku} from this return?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {removing.qty > 0
                  ? `${formatQty(removing.qty)} ${removing.uom} is removed, `
                  : 'It is removed, '}
                along with everything selected for it:
                {removing.trackingMode === 'serialized'
                  ? ' its serial numbers, '
                  : isLotMode(removing.trackingMode)
                    ? ' its lots and serial numbers, '
                    : ' '}
                its vendor and its receiving document. You can search for it again and select
                again.
              </p>
              <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] p-3">
                <span className="w-9 h-9 shrink-0 overflow-hidden rounded-md border border-[#E8ECF1]">
                  <ImageWithFallback
                    src={imageForSku(removing.sku)}
                    alt={removing.sku}
                    className="w-full h-full object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[12px] text-foreground"
                    style={{ fontWeight: 600 }}
                  >
                    {removing.sku}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {removing.description}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                  {formatQty(removing.qty)} {removing.uom}
                </span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3.5 text-[13px] text-foreground transition-colors hover:bg-[#FAFBFC]"
                style={{ fontWeight: 600 }}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(removing.key);
                  setRemoving(null);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3.5 text-[13px] text-white transition-colors hover:bg-red-700"
                style={{ fontWeight: 600 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── The step's own question ─────────────────────────────────── */}
      {/* It read "Add items to return" on every step, including the two that
          have nothing to do with adding items. The band says which question is
          on screen, and the search that answers the first one goes with it. */}
      <div className="relative flex shrink-0 flex-col overflow-visible border-b border-border bg-white">
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
            {stage === 'items' ? (
              <ListChecks className="w-4 h-4 text-primary" />
            ) : stage === 'units' ? (
              <ScanLine className="w-4 h-4 text-primary" />
            ) : stage === 'vendor' ? (
              <Building2 className="w-4 h-4 text-primary" />
            ) : (
              <FileText className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {stage === 'items'
                ? 'Select items to return'
                : stage === 'units'
                  ? 'Set up item'
                  : stage === 'vendor'
                    ? 'Select a vendor for each item'
                    : 'Select receiving documents'}
            </span>
            <div className="flex flex-wrap items-center gap-0.5">
              <span className="text-[11px] text-slate-500">
                {stage === 'items'
                  ? 'Search for an item, add it with +, then enter the quantity to return.'
                  : stage === 'units'
                    ? "Open a serialized or lot-controlled item to pick its units. For non-serialized items, choose the vendor you're returning to."
                    : stage === 'vendor'
                      ? 'Select the vendor you are returning each item to.'
                      : 'Select the receiving documents to return against.'}
              </span>
              {/* On the documents step the link has something to say, so it
                  says it here rather than pointing at a manual: why two of
                  the three kinds of item never reach this step at all. */}
              <HoverCard openDelay={80} closeDelay={140}>
                <HoverCardTrigger asChild>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-0.5 text-[11px] text-primary tracking-wide"
                    style={{ fontWeight: 600 }}
                  >
                    Learn More
                    <ArrowUpRight className="w-3 h-3 shrink-0 text-blue-300" />
                  </a>
                </HoverCardTrigger>
                <HoverCardContent
                  align="start"
                  sideOffset={8}
                  className="w-[380px] rounded-lg border border-border bg-white p-0 shadow-lg"
                >
                  <div className="border-b border-[#F1F5F9] px-3.5 py-2.5">
                    <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                      {stage === 'receivers'
                        ? 'Why this item has to be linked by hand'
                        : 'How an item finds its vendor and its documents'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5 px-3.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-px flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-600">
                        <Hash className="w-3 h-3" />
                      </span>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        <span className="text-foreground" style={{ fontWeight: 600 }}>
                          Serialized and lot items link themselves.
                        </span>{' '}
                        A unit number carries the receipt it arrived on and a batch carries its
                        delivery, so choosing the units chooses the vendor and the documents with
                        them. Nothing to select here.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-px flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-600">
                        <Layers className="w-3 h-3" />
                      </span>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        <span className="text-foreground" style={{ fontWeight: 600 }}>
                          Non-serialized items cannot.
                        </span>{' '}
                        {/* The plain-copy standard: say the fact, not the
                            figure of speech. "One bolt is any bolt" needs the
                            reader to work out what it stands for before the
                            sentence means anything. */}
                        Non-serialized items do not record which delivery they came from. You say
                        which receiving documents the credit reverses, and that decision is what
                        the accounting unwinds.
                      </p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>

          {/* Who the return is with, on the same line as the question rather
              than in a band of its own above it.
              
              Two full-width bands, same height, same weight, one on top of
              the other: the eye had two headers to choose between and no way
              to tell which one the screen was about. The step asks; this
              answers, off to the side, the way a status belongs. The sentence
              behind it keeps its detail on the hover, where an explanation
              can be read once rather than sat through every step. */}
          {/* Who the return is with, drawn as the fact it is.
              
              It was a grey chip in the corner at 12px, which is where a
              status goes, and this is not a status: it is the single thing
              every other answer on the step depends on. A full-width band
              across the header did not help either -- a stripe the same
              colour as the header is furniture. What reads is contrast and
              identity, so it is the vendor's own avatar at 40px, their name
              at 15px, on a blue surface with a primary bar down its edge, and
              it no longer hides on a narrow screen. */}
          {lockedVendor && lockedVendorName && (
            <div className="shrink-0">
              <HoverCard openDelay={80} closeDelay={140}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/40 py-1.5 pl-3 pr-3 text-left transition-colors hover:border-primary/30 hover:bg-blue-50/70"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-primary/70" />
                    <VendorAvatar name={lockedVendorName} size="sm" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span
                        className="text-[9.5px] uppercase text-slate-400"
                        style={{ fontWeight: 600, letterSpacing: '0.07em' }}
                      >
                        Returning to
                      </span>
                      <span
                        className="max-w-[210px] truncate text-[13px] text-foreground"
                        style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                      >
                        {lockedVendorName}
                      </span>
                    </span>
                    <ChevronDown className="w-3 h-3 shrink-0 text-slate-300 transition-colors group-hover:text-primary/60" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  align="end"
                  sideOffset={8}
                  className="w-auto overflow-hidden rounded-xl border-0 p-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                >
                  {/* Vendor invoicing's own quick card, not a second one
                      written here: the same vendor should look the same
                      wherever it is hovered. */}
                  <VendorQuickCard vendor={lockedVendorName} />
                  {/* The card is a fixed 280 wide, so the line under it is
                      too: left to size itself it hung off the edge. */}
                  <div className="w-[280px] border-t border-[#F1F5F9] bg-white px-4 py-2.5">
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Every item on this return goes back to {lockedVendorName}.
                      {lockedVendorNote ? ` ${lockedVendorNote}` : ''}
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          )}
        </div>

        {/* The search bar, always visible. */}
        {stage === 'items' && (
        <div className="border-b border-border px-4 pt-1 pb-3" ref={wrapRef}>
          <div className="relative">
            {/* Lit while the dropdown is open, and while the field merely has
                focus. Adding a part hands focus straight back to the search --
                that is the loop this step is -- but the ring went out with the
                dropdown, so the bar went grey at the exact moment it was ready
                for the next part, and the step read as finished after one. */}
            <div
              className={`relative w-full rounded-md bg-white transition-all ${
                searchOpen || searchFocused
                  ? 'border border-blue-300 shadow-[0_0_0_2px_var(--color-blue-100,#dbeafe)]'
                  : 'border border-border shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <Search className="w-4 h-4 shrink-0 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    onQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onClick={() => setSearchOpen(true)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      searchRef.current?.blur();
                    }
                  }}
                  // Once something is on the return the bar is not asking the
                  // same question again, it is offering to go round once more.
                  // Saying so is the whole of what was missing: the step looked
                  // like a search that had been used up.
                  placeholder={
                    lines.length === 0 ? 'Search items to return' : 'Search to add another item'
                  }
                  aria-label="Search parts to return"
                  className="w-full min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-foreground outline-none"
                  style={{ fontWeight: 500 }}
                />
                {lines.length > 0 && (
                  <div className="ml-1.5 flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5">
                    <Check className="w-2.5 h-2.5 text-primary" />
                    <span className="text-[10px] text-primary whitespace-nowrap" style={{ fontWeight: 600 }}>
                      {lines.length} {lines.length === 1 ? 'item' : 'items'} added
                    </span>
                  </div>
                )}
                {searchOpen && (
                  <kbd className="ml-1 shrink-0 rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] leading-none text-slate-400">
                    esc
                  </kbd>
                )}
              </div>
            </div>

            {/* The dropdown. Rows add on click; the round target adds without
                closing it, which is how a run of parts gets added in one go. */}
            {searchOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[151] max-h-[320px] overflow-y-auto rounded-lg border border-border bg-white p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.14)]">
                  <p
                    className="px-2 pt-1 pb-1.5 text-[10px] text-slate-400 uppercase tracking-wide"
                    style={{ fontWeight: 600 }}
                  >
                    {query.trim() ? 'Items' : 'Recently received'}
                  </p>
                  {results.length === 0 ? (
                    <div className="px-2 py-6 text-center">
                      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                        Nothing matches “{query.trim()}”
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Try the part number, or a word from the description. Stock created
                        in inventory can be returned too.
                      </p>
                    </div>
                  ) : (
                    results.map((item) => {
                      const added = on.has(item.sku);
                      // Everything it has is spoken for. The row still lists,
                      // because a part that is in the building and cannot be
                      // returned is a fact somebody is looking for; it just
                      // cannot be added here.
                      const shelf = item.stock.find((sh) => sh.uom === item.uom) ?? item.stock[0];
                      const blocked = !!shelf && shelf.split.onHand > 0 && shelf.split.available <= 0;
                      return (
                        <div
                          key={item.sku}
                          onClick={() => {
                            if (blocked) return;
                            if (added) onRemove(item.sku);
                            else onAdd(item.sku);
                            onQuery('');
                            setSearchOpen(false);
                          }}
                          className={`group flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors ${
                            blocked
                              ? 'cursor-not-allowed opacity-60'
                              : added
                                ? 'cursor-pointer bg-blue-50'
                                : 'cursor-pointer hover:bg-[#F5F9FF]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (added) onRemove(item.sku);
                              else onAdd(item.sku);
                              // Closed, then handed the field back. Left open
                              // it covered the count-all row and the first
                              // rows of the table, so the click that followed
                              // was spent dismissing it. The field keeps focus
                              // so a run of parts is still one gesture each.
                              onQuery('');
                              setSearchOpen(false);
                              searchRef.current?.focus();
                            }}
                            disabled={blocked}
                            aria-label={
                              blocked
                                ? `${item.sku} is fully allocated and cannot be returned`
                                : added
                                  ? `Take ${item.sku} off this return`
                                  : `Add ${item.sku} to this return`
                            }
                            className={`flex w-6 h-6 shrink-0 items-center justify-center rounded-full transition-all ${
                              blocked
                                ? 'cursor-not-allowed border-[1.5px] border-slate-200 text-slate-300'
                                : added
                                  ? 'bg-primary text-white'
                                  : 'border-[1.5px] border-border text-slate-400 hover:border-primary hover:text-primary'
                            }`}
                          >
                            {blocked ? (
                              <Lock className="w-3 h-3" />
                            ) : added ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </button>
                          <span className="w-7 h-7 shrink-0 overflow-hidden rounded-md border border-border bg-white">
                            <ImageWithFallback
                              src={imageForSku(item.sku)}
                              alt={item.sku}
                              className="w-full h-full object-cover"
                            />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`whitespace-nowrap text-[13px] ${added ? 'text-primary' : 'text-foreground'}`}
                                style={{ fontWeight: 600 }}
                              >
                                {highlight(item.sku, query.trim())}
                              </span>
                              <TrackingTag mode={item.trackingMode} size="md" />
                            </div>
                            <ItemDescriptionWithToggle
                              description={longDescriptionFor(item.sku, item.description)}
                              highlightText={highlight}
                              itemSearch={query}
                              widthClass="w-full"
                              hugText
                              textClass="text-[11px]"
                            />
                          </div>
                          <div className="ml-1 flex shrink-0 items-center gap-1.5">
                            {item.lastReceivedDate && (
                              <span className="inline-flex h-5 items-center rounded-full border border-border bg-slate-50 px-1.5 text-[10px] text-slate-500 whitespace-nowrap">
                                Last received: {formatDate(item.lastReceivedDate)}
                              </span>
                            )}
                            {blocked ? (
                              <span
                                className="inline-flex h-5 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 text-[10px] text-red-700 whitespace-nowrap"
                                style={{ fontWeight: 600 }}
                              >
                                <Lock className="w-2.5 h-2.5" />
                                Fully allocated
                              </span>
                            ) : shelf && shelf.split.allocated > 0 ? (
                              <span className="inline-flex h-5 items-center rounded-full border border-border bg-slate-50 px-1.5 text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatQty(shelf.split.available)} of {formatQty(shelf.split.onHand)}{' '}
                                {item.uom} available
                              </span>
                            ) : (
                              <span className="inline-flex h-5 items-center rounded-full border border-border bg-slate-50 px-1.5 text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatQty(item.returnableQty)} {item.uom}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ── Nothing added yet ───────────────────────────────────────
          The picker's own empty state, ported verbatim from
          ItemSearchModal: same tile, same two lines, same wording. Naming the
          three kinds of tracking here is the one place the flow can say,
          before anything is typed, that all of them come back through the same
          search -- and the wording matches the chip each result carries, so
          the answer looks like the question.

          The planner puts no furniture on an empty step: no rail, no table, no
          column headers standing over nothing. The whole panel stays one
          target that sends you back to the search, because searching is the
          only thing there is to do. */}
      {lines.length === 0 ? (
        // The panel is still one target -- the whole thing sends you back to
        // the search, because searching is the only thing there is to do --
        // but a whole panel that happens to be clickable is not something
        // anybody clicks. The button below says so out loud and is the part
        // the keyboard reaches; the surrounding div is a convenience for the
        // mouse, which is why it is a div and not a second widget wrapped
        // round the first.
        <div
          onClick={() => {
            setSearchOpen(true);
            searchRef.current?.focus();
          }}
          className="flex min-h-0 w-full flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center transition-colors hover:bg-[#FAFBFC]"
        >
          <div className="mb-3 flex w-12 h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
            <PackageSearch className="w-5 h-5" />
          </div>
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            Search serialized, lot and non-serialized items
          </p>
          <p className="mt-1 max-w-sm text-[12px] text-slate-500">
            Type a part number or a word from its description, add the items, then enter the
            quantity to return for each.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearchOpen(true);
              searchRef.current?.focus();
            }}
            aria-label="Search items to return"
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ fontWeight: 600 }}
          >
            <Search className="w-4 h-4" />
            {/* "Add" is the decision of September 16. The button opens the
                search, but what the user came here to do is put parts on the
                return, and naming it after the mechanism made the step read
                as a place to look things up. */}
            Add
          </button>
        </div>
      ) : (
      /* ── Two-panel master-detail ─────────────────────────────────── */
      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
        {/* The rail: what has been added. It is the whole screen on its own
            two steps -- what is going back, then how much of it -- because the
            panel beside it would have nothing to say until both are answered.
            After that it narrows and the panel asks about the focused line. */}
        <div
          className={`relative z-[1] flex flex-col bg-white ${
            railOnly
              ? 'min-w-0 flex-1'
              : 'w-[460px] min-w-[460px] shrink-0 border-r border-border'
          }`}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
            {asked.map((l) => renderRow(l))}

            {/* The empty state again, once there is something on the return.
                Compact, because the parts above it are the subject now and
                this is the invitation to add the next one -- but the same
                tile, the same voice and the same button, so the step reads as
                one loop rather than a screen that changed its mind about how
                to ask.

                In the list rather than pinned under it. It is the end of what
                is on the return, which is exactly where somebody who has just
                finished reading the list is looking, and a band bolted to the
                bottom would have sat immediately above the wizard's own
                footer arguing with Continue. */}
            {railOnly && lines.length > 0 && (
              <div
                onClick={() => {
                  setSearchOpen(true);
                  searchRef.current?.focus();
                }}
                className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 border-t border-dashed border-border px-6 py-6 text-center transition-colors hover:bg-[#FAFBFC]"
              >
                <div className="flex w-9 h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                  <PackageSearch className="w-4 h-4" />
                </div>
                <p className="text-[12px] text-slate-500">
                  Add another item to this return
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchOpen(true);
                    searchRef.current?.focus();
                  }}
                  aria-label="Add items to this return"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[12px] text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add items
                </button>
              </div>
            )}
          </div>

          {/* What this step does not ask about, along the bottom.

              Not hidden and not a second list to scroll past: a plain line has
              no units to name, and a serialized line's vendor was read off the
              units it already carries. Both are settled rather than
              outstanding, so they sit under the questions as one line that
              says how many and why, and hovering it says which parts. A part
              in there still opens its panel from the popover, so nothing
              becomes unreachable. */}
          {settled.length > 0 && (
            <HoverCard openDelay={80} closeDelay={140}>
              <HoverCardTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${settled.length} ${TRACKING_LABELS[settledKind].toLowerCase()} on this return, not asked about here`}
                  className="flex shrink-0 items-center gap-2 border-t border-border bg-[#FAFBFC] px-4 py-2.5 transition-colors hover:bg-[#F1F5FA]"
                >
                  <TrackingTag mode={settledKind} size="md" />
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                    {settled.length} {settled.length === 1 ? 'item' : 'items'}
                  </span>
                  <span className="ml-auto min-w-0 truncate text-[11px] text-slate-400">
                    {settledWhy}
                  </span>
                  <ChevronUp className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-[400px] p-0"
              >
                <p className="border-b border-border px-3 py-2 text-[11px] text-slate-500">
                  {settledWhy}. Open one to see it anyway.
                </p>
                <div className="max-h-[280px] overflow-y-auto py-1">
                  {settled.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => onFocus(l.key)}
                      aria-label={`Open ${l.sku} in ${l.uom}`}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#FAFBFC]"
                    >
                      <span className="w-8 h-8 shrink-0 overflow-hidden rounded-md border border-[#E8ECF1]">
                        <ImageWithFallback
                          src={imageForSku(l.sku)}
                          alt={l.sku}
                          className="w-full h-full object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[12px] text-foreground"
                          style={{ fontWeight: 600 }}
                        >
                          {l.sku}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {l.description}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {formatQty(l.qty)} {l.uom}
                        </span>
                        {/* What the line already says, on the steps where it
                            says something a person would otherwise go looking
                            for. On the units step every note is the footer's
                            own sentence again, so it is left off. */}
                        {stage !== 'units' && answeredNote?.(l) && (
                          <span className="max-w-[150px] truncate text-[10px] text-slate-400">
                            {answeredNote(l)}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>

        {/* The detail: the deliveries this part can come off. */}
        {!railOnly && (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
          {!line ? null : (
            <>
              {/* The item, stated once over its table. Flush across the panel
                  with a rule top and bottom and no sides, which is how the
                  planner bands it; the figure it is about sits on the right as
                  a pill, so the table underneath carries no total of its own. */}
              {/* The body scrolls under the band rather than taking it with it. */}
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2 pb-4">
              {/* Nothing on this line can go back to the vendor the return is
                  with. Said as a dead end with a way out, rather than
                  quietly raising a second RMA behind the user: the point of
                  one vendor per return is that the mistake is theirs to see
                  and undo. */}
              {stage === 'units' && conflictNote?.kind === 'unshipped' && (
                /* A note, not an alarm. One line of fact, one line of
                   consequence, and the two ways out on the same row: the
                   item can go back either way, so the band should cost a
                   glance rather than a paragraph. */
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2.5">
                  <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-white text-primary">
                    <Info className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-[200px] flex-1">
                    <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                      {conflictNote.lockName} has never shipped {line.sku}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      One return goes back to one vendor. Send it to them anyway, or remove it.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={conflictNote.onUse}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700"
                      style={{ fontWeight: 600 }}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Send it to {conflictNote.lockName}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(line)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 text-[12px] text-slate-600 transition-colors hover:border-primary/40 hover:text-foreground"
                      style={{ fontWeight: 600 }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove item
                    </button>
                  </div>
                </div>
              )}
              {/* The three that need a decision, in the shape of the note
                  above them: title, one line of why, and the ways out on the
                  same row. Amber rather than grey, because each of these is
                  holding the step up -- but a paragraph in a coloured box
                  reads as an incident report, and none of these is one. */}
              {stage === 'units' && conflictNote && conflictNote.kind !== 'unshipped' && (
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <div className="min-w-[220px] flex-1">
                    <p className="text-[12px] text-amber-900" style={{ fontWeight: 600 }}>
                      {conflictNote.kind === 'blocked'
                        ? `${line.sku} cannot go back to ${conflictNote.lockName}`
                        : conflictNote.kind === 'switch'
                          ? `${line.sku} is set to go back to ${conflictNote.currentName}`
                          : `${conflictNote.lockName} has only ${formatQty(conflictNote.cap)} ${conflictNote.uom} of ${line.sku} to take back`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      {conflictNote.kind === 'blocked' ? (
                        <>
                          Every unit of it came in from{' '}
                          {conflictNote.owners.length === 1
                            ? conflictNote.owners[0]
                            : `${conflictNote.owners.slice(0, 2).join(' and ')}${
                                conflictNote.owners.length > 2
                                  ? ` and ${conflictNote.owners.length - 2} more`
                                  : ''
                              }`}
                          . It needs an RMA of its own.
                        </>
                      ) : conflictNote.kind === 'switch' ? (
                        <>This return is with {conflictNote.lockName}, and one return goes back to one vendor.</>
                      ) : (
                        <>
                          The line is set to return {formatQty(conflictNote.declared)}{' '}
                          {conflictNote.uom}. The rest cannot be picked here.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {conflictNote.kind === 'switch' && (
                      <button
                        type="button"
                        onClick={conflictNote.onSwitch}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-600 px-2.5 text-[11px] text-white transition-colors hover:bg-amber-700"
                        style={{ fontWeight: 600 }}
                      >
                        <Building2 className="w-3 h-3" />
                        Move to {conflictNote.lockName}
                      </button>
                    )}
                    {conflictNote.kind === 'shortfall' && (
                      <button
                        type="button"
                        onClick={conflictNote.onFix}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-600 px-2.5 text-[11px] text-white transition-colors hover:bg-amber-700"
                        style={{ fontWeight: 600 }}
                      >
                        <Hash className="w-3 h-3" />
                        Update to {formatQty(conflictNote.cap)} {conflictNote.uom}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoving(line)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 text-[11px] text-amber-900 transition-colors hover:bg-amber-100"
                      style={{ fontWeight: 600 }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove item
                    </button>
                  </div>
                </div>
              )}

              {/* The picker stays on screen even where the line cannot go
                  back to this vendor. Blanking the panel read as the units
                  and the batches having been taken away: what is on the
                  shelf is still on the shelf, and the band above already
                  says why none of it can be picked. Shown and shut beats
                  hidden. */}
              {line.qty <= 0 ? (
                <NeedsQuantity line={line} cap={cap} />
              ) : serialized ? (
                <SerialStages
                  stage={stage}
                  unitPicker={unitPicker}
                  line={line}
                  lockedVendor={lockedVendor}
                  cap={cap}
                  named={named}
                  deliveries={deliveries}
                  merge={merge}
                  onOpenUnits={onOpenUnits}
                  onMerge={onMerge}
                />
              ) : line.trackingMode === 'none' && stage === 'units' && vendorPicker ? (
                vendorPicker
              ) : isLotMode(line.trackingMode) && stage === 'units' ? (
                // The picker itself where the panel would otherwise hold a
                // button that opens it.
                lotPicker ?? <LotStage line={line} cap={cap} lotQty={lotQty} onOpenLots={onOpenLots} />
              ) : line.trackingMode === 'none' || isLotMode(line.trackingMode) ? (
                // A lot line asks the counted line's questions once its
                // batches are named: the batch says what arrived, not who sent
                // it. It used to answer them on a flat delivery table instead,
                // which never set a vendor, and a return with no vendor saves
                // as nothing at all.
                (
                <CountedStages
                  stage={stage}
                  line={line}
                  cap={cap}
                  shelves={shelves}
                  onDeclare={onDeclare}
                  onUom={onUom}
                  volumeUom={volumeUom}
                  unitsReceived={unitsReceived}
                  familyOnReturn={familyOnReturn}
                  lockedVendor={lockedVendor}
                  lockedVendorName={lockedVendorName}
                  vendors={vendors}
                  chosen={chosenVendor}
                  receivers={deliveries}
                  docsForVendor={docsForVendor}
                  untied={untied}
                  merge={merge}
                  onPickVendor={onPickVendor}
                  onCreateVendor={onCreateVendor}
                  onRowQty={onRowQty}
                  onAllRows={onAllRows}
                  onOpenPO={onOpenPO}
                  currencyLock={currencyLock}
                  onUntied={onUntied}
                  onMerge={onMerge}
                />
                )
              ) : (
              <>
              {/* Detail search, at half width as the planner has it. Lot lines
                  still answer on the flat table; the brief covers serialized
                  and counted, and a lot picker is its own question. */}
              <div className="flex h-10 w-1/2 shrink-0 items-center gap-2 rounded-md border border-border bg-white px-3 shadow-sm">
                <Search className="w-4 h-4 shrink-0 text-slate-400" />
                <input
                  value={detailQuery}
                  onChange={(e) => setDetailQuery(e.target.value)}
                  placeholder="Search deliveries"
                  aria-label={`Search the deliveries of ${line.sku}`}
                  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground outline-none"
                />
                {detailQuery && (
                  <button
                    type="button"
                    onClick={() => setDetailQuery('')}
                    aria-label="Clear the delivery search"
                    className="flex w-5 h-5 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>

              <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                {/* Count-all row, above the headers. */}
                <div className="flex h-11 items-center border-b border-border bg-[#FAFBFC] px-4">
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-2"
                    onClick={() => onAllRows(!allOn)}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allOn}
                      aria-label="Return against every delivery"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAllRows(!allOn);
                      }}
                      className={`relative w-9 h-5 shrink-0 rounded-full border-none transition-colors ${
                        allOn ? 'bg-primary' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                          allOn ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                      Return against every delivery
                    </span>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      title={
                        allOn
                          ? 'Every delivery gives back what it brought in. Turn this off to choose them one at a time.'
                          : 'Tick the deliveries this is coming off. Turning this on takes the whole of every one.'
                      }
                      className="inline-flex items-center text-slate-400"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </div>

                </div>

                {/* Column headers. */}
                <div className="flex h-10 items-center border-b border-border bg-[#FAFBFC] px-4">
                  <span
                    className="flex flex-1 items-center text-[11px] text-slate-500"
                    style={{ fontWeight: 600 }}
                  >
                    Receiving document
                    <span className="ml-2 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-border bg-white px-2 text-[11px] text-slate-400 tabular-nums">
                      {visible.length}
                    </span>
                  </span>
                  <span
                    className="w-[100px] shrink-0 text-right text-[11px] text-slate-500"
                    style={{ fontWeight: 600 }}
                  >
                    Received
                  </span>
                  <span
                    className="ml-6 w-[110px] shrink-0 text-left text-[11px] text-slate-500"
                    style={{ fontWeight: 600 }}
                  >
                    To return
                  </span>
                  {serialized && <span className="w-[130px] shrink-0" />}
                </div>

                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12px] text-slate-500">
                    {deliveries.length === 0
                      ? `No delivery of ${line.sku} in ${line.uom} on file, so there is no document for the credit to reverse.`
                      : `No delivery matches “${detailQuery.trim()}”.`}
                  </p>
                ) : (
                  visible.map((d) => {
                    const used = d.coming > 0;
                    return (
                      <div
                        key={d.grnNumber}
                        className={`group flex min-h-[56px] items-center border-b border-border px-4 transition-colors last:border-b-0 ${
                          used ? 'bg-blue-50/40' : 'bg-white hover:bg-[#FAFBFC]'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          {/* Hidden while every delivery is in use, as the
                              planner hides them: the row is included whatever
                              the box says. */}
                          {!allOn && (
                            <Checkbox
                              checked={used}
                              onCheckedChange={(next) =>
                                onRowQty(d.grnNumber, next === true ? d.received : 0)
                              }
                              aria-label={`Return against ${d.grnNumber}`}
                            />
                          )}
                          <span
                            className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-md border ${
                              used
                                ? 'border-primary/30 bg-blue-50 text-primary'
                                : 'border-border bg-slate-50 text-slate-400'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className="truncate text-[13px] text-foreground"
                                style={{ fontWeight: 600 }}
                              >
                                {highlight(d.grnNumber, detailQuery.trim())}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
                                {d.date ? `${d.date} · ` : ''}PO {d.poNumber}
                              </span>
                            </div>
                            {/* The vendor rides on the document, which is why
                                this step never asks for one. */}
                            <p className="truncate text-[11px] text-slate-500">
                              {highlight(d.vendorName, detailQuery.trim())}
                            </p>
                          </div>
                        </div>

                        <span
                          className="w-[100px] shrink-0 text-right text-[13px] text-slate-500 tabular-nums whitespace-nowrap"
                          style={{ fontWeight: 500 }}
                        >
                          {formatQty(d.received)} {line.uom}
                        </span>

                        {/* The one cell anybody types in. A serialized row is
                            not one of them: its figure is however many units
                            were named, so it reports and offers the picker. */}
                        <div className="ml-6 flex w-[110px] shrink-0 items-center">
                          {serialized ? (
                            <span
                              className="text-[13px] text-foreground tabular-nums whitespace-nowrap"
                              style={{ fontWeight: 600 }}
                            >
                              {formatQty(d.coming)}
                              <span className="text-slate-400"> / {formatQty(d.units ?? d.received)}</span>
                            </span>
                          ) : (
                            <TieQtyInput
                              value={d.coming}
                              max={d.received}
                              uom={line.uom}
                              ariaLabel={`Quantity of ${line.sku} to return from ${d.grnNumber}`}
                              onChange={(n) => onRowQty(d.grnNumber, n)}
                              className={`h-8 w-[72px] rounded-md border px-2 text-[13px] text-foreground tabular-nums outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 ${
                                used ? 'border-primary/30 bg-white' : 'border-border bg-white'
                              }`}
                            />
                          )}
                        </div>

                        {serialized && (
                          <div className="flex w-[130px] shrink-0 items-center justify-end">
                            <button
                              type="button"
                              onClick={() => onOpenUnits(d.grnNumber)}
                              aria-label={`Name the units coming off ${d.grnNumber}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-[12px] text-foreground transition-colors hover:bg-slate-50"
                              style={{ fontWeight: 500 }}
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              {used ? 'Change units' : 'Name units'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              </>
              )}
              </div>
            </>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
}

/**
 * How much of a line is tied to one delivery.
 *
 * Drawn straight off the committed figure, the box lost a decimal point as it
 * was typed: 1.75 committed as 1, redrew as "1", and the 75 ran on behind it
 * as 175, which the ceiling then showed as whatever that delivery carried. The
 * draft is held here so what was typed stands, and a figure past the delivery
 * is cut to it out loud rather than appearing from nowhere.
 */
function TieQtyInput({
  value,
  /** What the delivery actually carried. Nothing may be tied beyond it. */
  max,
  uom,
  ariaLabel,
  className,
  onChange,
}: {
  value: number;
  max: number;
  uom: string;
  ariaLabel: string;
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
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => {
          const next = e.target.value.replace(',', '.');
          if (!QTY_DRAFT.test(next)) return;
          // Whole units here too: a tie is a count of goods against a
          // delivery, and the delivery counted them whole. The fraction goes
          // into the box and the tie drops to nothing. Dropping the keystroke
          // instead is what turned 2.5 into 25, the dot swallowed and the 5
          // running on behind the 2.
          // A tie is a count against a delivery, and a part without serial
          // numbers can go back in part, so a fraction stands as typed.
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
        className={className}
        style={{ fontWeight: 600 }}
      />
      {(capped || decimalRefused) && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
          style={{ fontWeight: 500 }}
        >
          {decimalRefused
            ? `Whole ${uom} only.`
            : `That delivery carried ${formatQty(max)} ${uom}.`}
        </span>
      )}
    </span>
  );
}

/**
 * The figure on the rail card.
 *
 * The same composite field the section under the item uses -- `QtyUomField`,
 * the figure and its shelf in one box -- sized for a 300px rail. It goes on
 * the row because that is where the part is already named: a card over the
 * detail restating the part, and a card under it holding one number, were two
 * surfaces for a question that fits on the row it belongs to.
 */
function RailQtyField({
  line,
  cap,
  shelves,
  whole = false,
  missing = false,
  onDeclare,
  onUom,
  onAddUnit,
  taken,
}: {
  line: RailLine;
  cap: number;
  shelves: ItemStock[];
  /** Serialized units move whole; half a serial number is not a thing. */
  whole?: boolean;
  /** Left empty, and Continue has been pressed. A part on the return with no
   *  figure against it is the one thing this step cannot go on without, and it
   *  was saying so only in the footer count -- a number at the far corner of
   *  the screen, about a row the user would then have to find. */
  missing?: boolean;
  onDeclare: (qty: number) => void;
  onUom: (uom: string) => void;
  /** Put this part on the return again in another unit, as its own line. */
  onAddUnit?: ((uom: string) => void) | undefined;
  /** Units of this part already on the return as their own line. */
  taken?: string[] | undefined;
}) {
  const [draft, setDraft] = useState(() => (line.qty > 0 ? String(line.qty) : ''));
  /** The last figure this field itself declared. The line is redrawn from
   *  whatever the step holds, and a write of our own coming back round would
   *  otherwise replace the text mid-keystroke -- which is what makes a
   *  refused entry recoverable: the box keeps saying 2.5 while the line
   *  honestly holds nothing. */
  const mine = useRef<number | null>(null);

  useEffect(() => {
    if (mine.current !== null && mine.current === line.qty) { mine.current = null; return; }
    setDraft(line.qty > 0 ? String(line.qty) : '');
  }, [line.qty, line.uom]);

  /** Declare a figure, remembering that it was ours. */
  const declare = (n: number) => { mine.current = n; onDeclare(n); };

  const onHand = shelves.find((sh) => sh.uom === line.uom)?.qty ?? cap;
  const typed = draft.trim() === '' ? null : Number(draft);
  const over = typed !== null && Number.isFinite(typed) && typed > onHand;
  // Only a serial-numbered line counts one unit at a time. Anything else can
  // go back in part, a partial box or a cut length (ERP-8654 AC3), so a
  // fraction there is an answer, not a mistake.
  const wholeOnly = whole || hasSerials(line.trackingMode);
  const fraction = wholeOnly && isFractional(draft);
  const [decimalRefused, refuseDecimal] = useRefusalNotice();

  return (
    <span className="relative flex items-center">
      <QtyUomField
        // By line, not by part: the same helmet in eaches and in boxes is two
        // fields, and two elements cannot share an id.
        id={`qty-${line.key}`}
        value={draft}
        uom={line.uom}
        shelves={shelves}
        invalid={over || missing || fraction}
        ariaLabel={`${line.sku} in ${line.uom}`}
        onValue={(next) => {
          const typedNext = next.replace(',', '.');
          if (!QTY_DRAFT.test(typedNext)) return;
          // What was typed always stands in the box. A figure the line cannot
          // take is shown in red and left uncommitted, so the step can refuse
          // to continue on it rather than quietly keeping an older number the
          // user can no longer see.
          setDraft(typedNext);
          // A fraction is not declared, and the line reads as unanswered while
          // it stands. A figure above what is available is declared as typed:
          // zeroing it made the step report "has no quantity" about a line
          // the user had just filled in. The over-return check refuses to
          // continue on it instead, and the box says why.
          if (wholeOnly && isFractional(typedNext)) { refuseDecimal(); declare(0); return; }
          const n = typedNext.trim() === '' ? 0 : Number(typedNext);
          if (!Number.isFinite(n) || n < 0) return;
          declare(n);
        }}
        onUom={onUom}
        onAddUnit={onAddUnit}
        taken={taken}
      />
      {over && !fraction && (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700"
          style={{ fontWeight: 500 }}
        >
          Only {formatQty(onHand)} {line.uom.toUpperCase()} available to return
        </span>
      )}
      {(decimalRefused || fraction) && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
          style={{ fontWeight: 500 }}
        >
          Whole {line.uom} only.
        </span>
      )}
    </span>
  );
}

/**
 * How much is coming back, asked in its own section under the item.
 *
 * It was on the band for a while, which kept it on screen but gave it no room
 * to say anything: a figure and a unit, and no answer to why the question is
 * the same one whatever the part is tracked by. Eli was explicit that it is --
 * "It doesn't matter whether it's serialized, lot control, nothing. I just put
 * in the number" -- and a rule like that is worth a sentence rather than a
 * layout that merely obeys it.
 *
 * The control is the catalogue step's own `QtyUomField`: the figure and the
 * shelf in one bordered box, the unit flush against the right edge behind a
 * divider, opening a searchable list of every unit the part is held in. One
 * answer, one control. A separate quantity field beside a stated unit said the
 * unit twice and split a single decision in half, which is why that field was
 * built this way in the first place.
 *
 * It is always open. Nothing is summoned, nothing collapses back into a pill,
 * and what is typed replaces what was there rather than adding to it.
 */
function QuantitySection({
  line,
  cap,
  shelves,
  onDeclare,
  onUom,
  children,
}: {
  line: RailLine;
  cap: number;
  shelves: ItemStock[];
  onDeclare: (qty: number) => void;
  onUom: (uom: string) => void;
  /** What falls out of the figure, inside the same container. */
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(() => (line.qty > 0 ? String(line.qty) : ''));
  const serialized = line.trackingMode === 'serialized';

  // The figure can move without this field: the band's line is rebuilt on a
  // unit change, and a counted line's ties re-lay across it.
  useEffect(() => {
    setDraft(line.qty > 0 ? String(line.qty) : '');
  }, [line.qty, line.uom]);

  const onHand = shelves.find((sh) => sh.uom === line.uom)?.qty ?? cap;
  const typed = draft.trim() === '' ? null : Number(draft);
  const invalid = typed !== null && (!Number.isFinite(typed) || typed < 0);
  const over = typed !== null && Number.isFinite(typed) && typed > onHand;
  // A decimal typed on a line counted unit by unit used to disappear into the
  // mask: the dot was dropped, the commit pushed the whole part back into the
  // box, and the digit after it landed behind that. 2.5 became 25. Still
  // refused, but it says so now.
  const [decimalRefused, refuseDecimal] = useRefusalNotice();
  const error = decimalRefused
    ? `${line.sku} goes back in whole ${line.uom}. Enter a whole number.`
    : invalid
    ? 'Enter a number'
    : over
      ? `Only ${formatQty(onHand)} ${line.uom} received`
      : null;

  /** Typing is the answer. A figure that is real and possible goes on the
   *  return as it is typed, the way the catalogue row records one. */
  const setQty = (next: string) => {
    if (hasSerials(line.trackingMode) && /[.,]/.test(next)) { refuseDecimal(); return; }
    next = next.replace(',', '.');
    if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
    setDraft(next);
    const n = next.trim() === '' ? 0 : Number(next);
    if (!Number.isFinite(n) || n < 0 || n > onHand) return;
    onDeclare(n);
  };

  return (
    <Stage
      icon={<Package className="w-3 h-3" />}
      title="Enter the quantity to return"
      hint={
        serialized
          ? 'Enter the quantity first, the same as any other item. Selecting the serial numbers comes next.'
          : 'One of these is any other, so there is nothing to select after this. The units carry no history of their own.'
      }
      figure={line.qty > 0 ? `${formatQty(line.qty)} ${line.uom}` : undefined}
      tone={line.qty > 0 ? 'done' : 'todo'}
    >
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px] text-slate-500">
            {formatQty(cap)} {line.uom} is available to return, which is everything that was
            received.
            {shelves.length > 1
              ? ' It can go back on a different shelf: change the unit in the field and the return is rewritten on it.'
              : ''}
          </p>
          {error && (
            <p
              className="mt-1.5 flex items-center gap-1.5 text-[12px] text-red-700"
              style={{ fontWeight: 500 }}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <QtyUomField
            id={`qty-${line.sku}`}
            value={draft}
            uom={line.uom}
            shelves={shelves}
            invalid={error !== null}
            ariaLabel={line.sku}
            onValue={setQty}
            onUom={onUom}
          />
        </div>
      </div>
      {children}
    </Stage>
  );
}

/** What the part has actually been received in, and how much of each.
 *
 *  The screen can say a line's unit has no receiving document behind it, and
 *  saying only that leaves the user to guess which unit would have. So the
 *  units that do exist are listed with their volumes, and each one that is not
 *  the line's own unit rewrites the line onto it in a press. Correcting the
 *  selection is the way out of this warning, so the way out sits inside it.
 *
 *  Nothing to list is possible -- a part counted in at a stocktake was never
 *  received at all -- and then this says so rather than drawing an empty box. */
function UnitsOnFile({
  units,
  lineUom,
  onUom,
}: {
  units: { uom: string; qty: number; docs: number }[];
  lineUom: string;
  onUom: (uom: string) => void;
}) {
  if (units.length === 0) {
    return (
      <p className="text-[12px] text-amber-800/80">
        Nothing on file was received in any unit, so there is no document to select.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-amber-200/70 bg-white px-3 py-2.5">
      <p
        className="text-[10px] uppercase tracking-[0.06em] text-slate-500"
        style={{ fontWeight: 700 }}
      >
        Received in
      </p>
      {units.map((u) => (
        <div key={u.uom} className="flex items-center justify-between gap-3 py-0.5">
          <span className="min-w-0 text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
            {formatQty(u.qty)} <span className="text-slate-500">{u.uom}</span>
            <span className="ml-1.5 text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {'on '}
              {u.docs} {u.docs === 1 ? 'document' : 'documents'}
            </span>
          </span>
          {u.uom === lineUom ? (
            <span className="shrink-0 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>
              This line
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onUom(u.uom)}
              className="shrink-0 inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] text-primary transition-colors hover:bg-blue-100"
              style={{ fontWeight: 600 }}
            >
              Return in {u.uom}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** How many receiving documents a page of the table holds. */
const DOCS_PER_PAGE = 10;

/** Wraps its children, or does not. Both panels put the vendors and the
 *  documents inside the card that asks for the figure, and take that card
 *  away when the rail is asking instead -- the same children, one container
 *  fewer, rather than two copies of the block. */
function Maybe({
  on,
  wrap,
  children,
}: {
  on: boolean;
  wrap: (children: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}) {
  return <>{on ? wrap(children) : children}</>;
}

/** A numbered stage. Shut until the one before it is answered, and never shut
 *  once opened -- a wrong serial has to be reachable after the fact. */
/** The detail panel before the line has a figure on it.
 *
 *  Everything this panel can say follows from how much is coming back: who
 *  can take back four of something is a different list from who can take back
 *  four hundred, and which units are going back is not a question until there
 *  is a number of them. A part can now arrive here with no quantity at all --
 *  ticked in the catalogue, or carried in whole off a vendor -- so the panel
 *  says what it is waiting for and points at the field that answers it,
 *  instead of showing an empty vendor list that reads as "nobody can".
 */
function NeedsQuantity({ line, cap }: { line: RailLine; cap: number }) {
  const serialized = line.trackingMode === 'serialized';
  return (
    <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-8 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
        <Hash className="w-5 h-5" />
      </div>
      <p className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
        Enter the quantity to return for {line.sku}
      </p>
      <p className="mt-1.5 max-w-[420px] text-[12px] text-slate-500 leading-relaxed">
        Enter the quantity on the item card on the left.{' '}
        {serialized
          ? 'Then select the serial numbers, and the vendor and receiving documents follow from what you select.'
          : 'Then the vendors who can take it back appear here, with the receiving documents the credit unwinds.'}
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-[#F7F9FC] px-2.5 py-1 text-[11px] text-slate-500 tabular-nums">
        <Package className="w-3.5 h-3.5 text-slate-400" />
        {formatQty(cap)} {line.uom} available to return
      </p>
    </div>
  );
}

function Stage({
  icon,
  title,
  hint,
  figure,
  tone = 'todo',
  children,
}: {
  /** What the stage is about, in the badge. Neither panel runs long enough
   *  now to number its stages, and a lone "1" is a sequence of one. */
  icon: React.ReactNode;
  title: string;
  hint?: string | undefined;
  figure?: string | undefined;
  tone?: 'todo' | 'done' | 'warn' | undefined;
  children: React.ReactNode;
}) {
  const ring =
    tone === 'done'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-primary/30 bg-blue-50 text-primary';
  return (
    <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-[#FAFBFC] px-4 py-2.5">
        <span
          className={`flex w-6 h-6 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums ${ring}`}
          style={{ fontWeight: 700 }}
        >
          {tone === 'done' ? <Check className="w-3 h-3" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </p>
          {hint && <p className="mt-px text-[11px] text-slate-500">{hint}</p>}
        </div>
        {figure && (
          <span
            className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap ${
              tone === 'warn' ? 'text-amber-700' : tone === 'done' ? 'text-emerald-700' : 'text-slate-400'
            }`}
            style={{ fontWeight: 600 }}
          >
            {figure}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * A serialized line, answered in Eli's three beats on one surface.
 *
 * The count first, because he was explicit that it is asked the same way
 * whatever the item is tracked by: "It doesn't matter whether it's serialized,
 * lot control, nothing. I just put in the number." That one is on the band
 * over this panel, in the same control a counted line gets, which is what
 * makes the sameness he asked for visible rather than merely true. Then the
 * units, held to that number -- the only reason the two are asked separately
 * at all, since nothing else catches a miscount on a list hundreds long. Then
 * the vendors and the documents, which are not asked for: a serial names its
 * own receiver, so they are read out of the picks and reported.
 *
 * Each beat opens only once the one before it has an answer, and none of them
 * shuts again. Somebody will pick the wrong serial and have to come back.
 *
 * The last beat is the counted panel's two tabs, deliberately: Vendors, and
 * Receiving documents. The question a user asks is the same one on both kinds
 * of line, and answering it in two different shapes was the inconsistency. But
 * nothing here is a control. There are no radios and no fields, because "for
 * the serialized units that have provenance, there is no next step. You
 * already know who they are, you'll surface who they are." The one action
 * anywhere in it is a way back into the units, which is the only thing that
 * can change what the tabs report.
 *
 * Then the sites, which the brief asks for and this panel did not have: one
 * vendor shipping off several of their own places is offered as one RMA or one
 * each rather than decided for them.
 */
function SerialStages({
  stage,
  line,
  unitPicker,
  lockedVendor,
  cap,
  named,
  deliveries,
  merge,
  onOpenUnits,
  onMerge,
}: {
  /** Which question this render is answering. Naming the units is its own step
   *  now; what falls out of them -- the vendors and their documents -- is read
   *  on the two steps after it. */
  stage: Exclude<ConfigureStage, 'items' | 'search'>;
  line: RailLine;
  /** The serial picker itself, drawn on the step rather than behind a button.
   *  Absent where the step has no room for it, which falls back to the
   *  dialog. */
  unitPicker?: React.ReactNode;
  /** Named before anything was picked, on the by-vendor route. There is no
   *  list of who else could take it back then, so there is no tab for one. */
  lockedVendor: string | null;
  cap: number;
  named: number;
  deliveries: DeliveryRow[];
  /** One RMA for the vendor, or one per site they shipped from. */
  merge: boolean;
  onOpenUnits: (grnNumber: string) => void;
  onMerge: (next: boolean) => void;
}) {
  // The step is the view. Who takes it back is one question and what the
  // credit unwinds is another, and they are two steps, so a tab strip offering
  // both on either of them put each step's answer on the other's screen.
  // Coming in by vendor there is no list of who else could take it either.
  const tab: 'vendor' | 'docs' = stage === 'vendor' && !lockedVendor ? 'vendor' : 'docs';
  const [openDocs, setOpenDocs] = useState<Set<string>>(() => new Set());

  const flip = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
  // Only what the picks point at. The part has been delivered eighty times and
  // the units decide which of those the return touches, so listing the rest
  // would be offering a choice that is not on the table.
  const traced = deliveries.filter((d) => d.coming > 0);
  const vendors = [...new Set(traced.map((d) => d.vendorName))];

  // The vendors read off the units, each carrying the documents that named
  // them. Not a candidate list: nobody is choosing between these.
  const byVendor = traced.reduce<
    { vendorCode: string; vendorName: string; units: number; docs: DeliveryRow[] }[]
  >((out, d) => {
    const found = out.find((v) => v.vendorCode === d.vendorCode);
    if (found) {
      found.units += d.coming;
      found.docs.push(d);
    } else {
      out.push({ vendorCode: d.vendorCode, vendorName: d.vendorName, units: d.coming, docs: [d] });
    }
    return out;
  }, []);

  // One vendor's goods off more than one of their sites: the only grouping
  // question a serialized line has, since who is taking it back was settled
  // by the units themselves.
  const sites = byVendor.length === 1
    ? [...new Set(traced.map((d) => d.originName ?? '').filter(Boolean))]
    : [];

  return (
    <>
      {/* The units, and nothing before them.
          
          A serial names itself, so asking for a count first asked for
          something the user would have to count twice: once in their head to
          type it, and again in the picker to prove it. Naming four units is
          the statement that four are coming back. The count follows from the
          list rather than being checked against it. */}
      {/* One card. The count is on the rail, the units are named in the
          picker, and what falls out of them -- the vendors and their
          documents -- is the rest of this same card. */}
      {/* With the picker on the step there is nothing for a header band to
          add: the rail says which part, the picker says how many are named,
          and a grey strip between them repeated both. It stays for the
          fallback, where the panel is a sentence and a button. */}
      {stage === 'units' && unitPicker}
      {stage === 'units' && !unitPicker && (
      <Stage
        icon={<ScanLine className="w-3 h-3" />}
        title="Select serial numbers to return"
        hint={
          line.qty <= 0
            ? 'Set how many on the card first, then name them here.'
            : named === line.qty
              ? 'Every unit named.'
              : named < line.qty
                ? `Pick ${formatQty(line.qty - named)} more, or change the count on the card.`
                : `${formatQty(named - line.qty)} too many named.`
        }
        figure={line.qty > 0 ? `${formatQty(named)} of ${formatQty(line.qty)} named` : undefined}
        tone={line.qty > 0 && named === line.qty ? 'done' : named > 0 || line.qty > 0 ? 'warn' : 'todo'}
      >
        {(
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <p className="min-w-0 text-[12px] text-slate-500">
              {named > 0
                ? 'Each serial number carries the delivery it arrived on, so the vendor is read off your selection rather than chosen.'
                : `${formatQty(cap)} ${line.uom} is on hand, each one a unit of its own. Select the serial numbers to return and the rest follows from them.`}
            </p>
            <button
              type="button"
              onClick={() => onOpenUnits('')}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] text-white whitespace-nowrap shadow-sm transition-colors hover:bg-blue-700"
              style={{ fontWeight: 600 }}
            >
              <ScanLine className="w-3.5 h-3.5" />
              Select serial numbers
            </button>
          </div>
        )}

      {/* Where they came from, read from either end. The same two tabs a
          counted line gets, and deliberately the same shape, because the
          question a user asks is the same one. What is different is that
          nothing here is a control: "for the serialized units that have
          provenance, there is no next step. You already know who they are,
          you'll surface who they are." So there are no radios and no fields,
          only a way back into the units, which is the one thing that can
          actually change any of it. */}
      {/* One container, because it is one answer. The units are the whole of
          the decision and the vendors and their documents are what falls out
          of it, so a second card put a border between a cause and its effect
          and invited the tabs to be read as another job. */}
      </Stage>
      )}

      {/* What the units turned out to mean: who is taking them back, and the
          documents that named them. Its own card now, because it answers the
          two steps after the one that names the units. */}
      {stage !== 'units' && named > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {/* The card names itself. A tab strip of one is not a choice, and
              the step above it has already said which question this is. */}
          <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-3">
            {tab === 'vendor' ? (
              <Building2 className="w-4 h-4 shrink-0 text-primary" />
            ) : (
              <FileText className="w-4 h-4 shrink-0 text-primary" />
            )}
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {tab === 'vendor' ? 'Vendors' : 'Receiving documents'}
            </span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 tabular-nums">
              {tab === 'vendor' ? byVendor.length : traced.length}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border bg-[#FAFBFC] px-4 py-2">
            <p className="min-w-0 truncate text-[12px] text-slate-500">
              Read off the units. A serial names its own receiver, so there is nothing to choose.
            </p>
            <span
              className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap ${
                byVendor.length > 1 ? 'text-amber-700' : 'text-emerald-700'
              }`}
              style={{ fontWeight: 600 }}
            >
              {formatQty(named)} {line.uom} traced
              {byVendor.length > 1 ? ` · ${byVendor.length} RMAs` : ''}
            </span>
          </div>

          {/* The split, stated where it is decided rather than sprung on Next,
              and above the tabs because it is a fact about the line rather
              than about either view of it. */}
          {byVendor.length > 1 && (
            <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
              <AlertTriangle className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
              <p className="text-[12px] text-amber-800">
                {byVendor.length} vendors, so {byVendor.length} RMAs. Each credits its own.
              </p>
            </div>
          )}

          {tab === 'vendor' ? (
            <div className="flex flex-col divide-y divide-[#F1F5F9]">
              {byVendor.map((v) => {
                const theirSites = [...new Set(v.docs.map((d) => d.originName ?? '').filter(Boolean))];
                return (
                  <div key={v.vendorCode}>
                    {/* No chevron. It opened this vendor's receiving documents
                        inside the vendor list, which is the next step's list on
                        this step's screen. What they shipped it on is counted
                        on the row and listed in full one step later. */}
                    <div className="flex items-center gap-2 pl-4 pr-4 transition-colors hover:bg-[#FAFBFC]">
                      <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-blue-50 text-primary">
                        <Building2 className="w-3 h-3" />
                      </span>
                      <span className="min-w-0 flex-1 py-2.5">
                        <span
                          className="block truncate text-[13px] text-foreground"
                          style={{ fontWeight: 600 }}
                        >
                          {v.vendorName}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {formatQty(v.units)} {line.uom} off {v.docs.length}{' '}
                          {v.docs.length === 1 ? 'document' : 'documents'}
                          {theirSites.length > 1 ? ` · ${theirSites.length} sites` : ''}
                        </span>
                      </span>
                      {/* Their share. Numbering the row "RMA 3 of 8" told the
                          user nothing the strip above had not already said,
                          and repeated it on every row. */}
                      <span
                        className="shrink-0 text-[11px] text-slate-500 tabular-nums whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                      >
                        {formatQty(v.units)} {line.uom}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex h-10 items-center border-b border-border bg-[#FAFBFC] pl-10 pr-4">
                <span
                  className="flex flex-1 items-center text-[11px] text-slate-500"
                  style={{ fontWeight: 600 }}
                >
                  Receiving document
                  <span className="ml-2 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-border bg-white px-2 text-[11px] text-slate-400 tabular-nums">
                    {traced.length}
                  </span>
                </span>
                <span
                  className="w-[100px] shrink-0 text-right text-[11px] text-slate-500"
                  style={{ fontWeight: 600 }}
                >
                  Received
                </span>
                <span
                  className="ml-6 w-[110px] shrink-0 text-left text-[11px] text-slate-500"
                  style={{ fontWeight: 600 }}
                >
                  To return
                </span>
              </div>

              {traced.map((d) => {
                const open = openDocs.has(d.grnNumber);
                return (
                  <div key={d.grnNumber} className="border-b border-border bg-white last:border-b-0">
                    <div className="flex min-h-[56px] items-center gap-2 pl-3 pr-4 transition-colors hover:bg-[#FAFBFC]">
                      <button
                        type="button"
                        onClick={() => setOpenDocs((set) => flip(set, d.grnNumber))}
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} the vendor of ${d.grnNumber}`}
                        className="flex w-5 h-5 shrink-0 items-center justify-center"
                      >
                        <ChevronRight
                          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                        />
                      </button>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-blue-50 text-primary">
                          <FileText className="w-3 h-3" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className="truncate text-[13px] text-foreground"
                              style={{ fontWeight: 600 }}
                            >
                              {d.grnNumber}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
                              {d.date ? `${d.date} · ` : ''}PO {d.poNumber}
                            </span>
                          </div>
                          {d.originName && (
                            <p className="truncate text-[11px] text-slate-500">{d.originName}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className="w-[100px] shrink-0 text-right text-[13px] text-slate-500 tabular-nums whitespace-nowrap"
                        style={{ fontWeight: 500 }}
                      >
                        {formatQty(d.units ?? d.received)} {line.uom}
                      </span>
                      <span
                        className="ml-6 w-[110px] shrink-0 text-left text-[13px] text-foreground tabular-nums whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                      >
                        {formatQty(d.coming)} {line.uom}
                      </span>
                    </div>

                    <div
                      aria-hidden={!open}
                      style={{
                        overflow: 'hidden',
                        maxHeight: open ? '84px' : '0px',
                        opacity: open ? 1 : 0,
                        transition: 'max-height 0.25s ease, opacity 0.2s ease',
                      }}
                    >
                      <div className="mx-4 mb-3 rounded-md border border-border bg-[#FAFBFC] px-2.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-border bg-white text-slate-400">
                            <Building2 className="w-3 h-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span
                              className="block truncate text-[12px] text-foreground"
                              style={{ fontWeight: 500 }}
                            >
                              {d.vendorName}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {d.originName ? `Shipped from ${d.originName} · ` : ''}
                              named by the units, not chosen
                            </span>
                          </div>
                          {/* The only thing that can change any of this. */}
                          <button
                            type="button"
                            onClick={() => onOpenUnits('')}
                            tabIndex={open ? 0 : -1}
                            className="shrink-0 text-[11px] text-primary transition-colors hover:underline"
                            style={{ fontWeight: 600 }}
                          >
                            Select serial numbers
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {stage !== 'units' && named === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            No units named yet
          </p>
          <p className="mx-auto mt-1.5 max-w-[380px] text-[12px] text-slate-500 leading-relaxed">
            A serial names its own vendor and its own receiving document, so both
            of those follow from the units. Step back and name them.
          </p>
        </div>
      )}
    </>
  );
}

/**
 * A counted line, answered in the order the brief asks for it.
 *
 * One bolt is any bolt, so provenance is not a fact to be read but a decision
 * to be made -- and it is made in one direction only. The quantity first, then
 * who is taking it back, then which of their deliveries the credit reverses.
 * Never the other way round: a vendor cannot be derived from a document here,
 * because any of their documents could have supplied any of these units.
 *
 * "One RMA, one vendor, always." So the vendor is a single choice rather than a
 * split, which is the whole difference from a serialized line -- there the
 * units name several vendors and the return has to break in two; here the user
 * names one and it stays one.
 *
 * Two ceilings, and they are different things. No tie may exceed what its own
 * delivery brought in, since a document cannot reverse more than it carried.
 * And nothing may exceed what the vendor ever shipped: asking a vendor for a
 * thousand when they only ever sent two hundred is not a tie that needs
 * spreading, it is an impossible return, and it is said as one.
 */
/** The planner's group toggle, which is its tab strip: a 3px-padded track on
 *  the panel's grey, the live tab lifted onto white with the accent colour and
 *  a soft shadow, each carrying a count in a pill. */
function TabStrip({
  tabs,
  active,
  onPick,
}: {
  tabs: { key: string; label: string; count: number; disabled?: boolean }[];
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="border-b border-border bg-white px-4 py-3">
      <div className="inline-flex items-center gap-[3px] rounded-[10px] bg-[#F1F5F9] p-[3px]">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={t.label}
              disabled={t.disabled}
              onClick={() => onPick(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? 'bg-white text-primary shadow-[0_1px_4px_rgba(15,23,42,0.12)]'
                  : 'bg-transparent text-slate-500 hover:text-foreground'
              }`}
              style={{ fontWeight: 600 }}
            >
              {t.label}
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums ${
                  on ? 'bg-blue-50 text-primary' : 'bg-slate-200/70 text-slate-400'
                }`}
                style={{ fontWeight: 700 }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A counted line, answered in the order the brief asks for it.
 *
 * One bolt is any bolt, so provenance is not a fact to be read but a decision
 * to be made -- and it is made in one direction only. The quantity first, on
 * the band over this panel, then who is taking it back, then which of their
 * deliveries the credit reverses. Never the other way round: a vendor cannot
 * be derived from a document here, because any of their documents could have
 * supplied any of these units.
 *
 * "One RMA, one vendor, always." So the vendor is a single choice rather than a
 * split, which is the whole difference from a serialized line -- there the
 * units name several vendors and the return has to break in two; here the user
 * names one and it stays one.
 *
 * The two that are left sit in the planner's group toggle rather than stacked
 * one above the other, and they are named after the things they hold rather
 * than after the questions they answer: Vendors, and Receiving documents.
 * Stacking them put the second so far down a long vendor list that it read as
 * a separate job. Picking a vendor moves to the documents by itself, since
 * that is what there is to do next, and the vendor tab stays one click away
 * because changing your mind about it is ordinary.
 *
 * Both tabs nest, the way the planner's Grouped by Location and Grouped by LOT
 * tables nest each other's rows: one relation read from either end. A vendor
 * opens onto the documents they shipped this on, which is many; a document
 * opens onto its vendor, which is always exactly one, because a receipt was
 * raised against a single vendor and cannot have been raised against two.
 *
 * Two ceilings, and they are different things. No tie may exceed what its own
 * delivery brought in, since a document cannot reverse more than it carried.
 * And nothing may exceed what the vendor ever shipped: asking a vendor for a
 * thousand when they only ever sent two hundred is not a tie that needs
 * spreading, it is an impossible return, and it is said as one.
 */
/** Who signed for a delivery.
 *
 *  The receipt record carries no receiver, and "Warehouse Team" for every
 *  document says nothing: the point of opening a receipt is to find the
 *  person who can answer for it. Hashed off the document number so the same
 *  receipt always names the same person. */
const RECEIVING_CLERKS = [
  'Marcus Webb',
  'Dana Whitfield',
  'Priya Raman',
  'Tomás Oliveira',
  'Grace Okafor',
  'Sam Castellano',
];
function receivedByFor(grnNumber: string): string {
  let h = 0;
  for (let i = 0; i < grnNumber.length; i++) h = (h * 31 + grnNumber.charCodeAt(i)) >>> 0;
  return RECEIVING_CLERKS[h % RECEIVING_CLERKS.length]!;
}

/** Everything that came in on one receipt, for the receipt's own table. The
 *  line being returned is only part of a delivery, and what else arrived with
 *  it is half of what makes a document recognisable. */
function receiptLines(row: DeliveryRow) {
  const vendor = mockVendors.find((v) => v.vendorCode === row.vendorCode);
  const grn = vendor?.receivingDocuments.find((d) => d.grnNumber === row.grnNumber);
  if (!grn) return [];
  // Ordered comes off the purchase order, received off the receipt. Reading
  // both from the receipt line made every document claim it took in three
  // times what was ordered.
  const ordered = new Map(
    (vendor?.purchaseOrders ?? [])
      .filter((po) => po.poNumber === grn.poNumber)
      .flatMap((po) => po.items.map((li) => [li.sku, li.quantity] as const)),
  );
  return grn.items.map((li) => ({
    sku: li.sku,
    productName: li.description,
    uom: li.uom,
    orderedQty: ordered.get(li.sku) ?? li.quantity,
    receivedQty: li.quantity,
    serialized: hasSerials(trackingModeFor(li.sku)),
  }));
}

function CountedStages({
  stage,
  line,
  cap,
  shelves,
  onDeclare,
  onUom,
  volumeUom,
  unitsReceived,
  familyOnReturn,
  lockedVendor,
  lockedVendorName,
  vendors,
  chosen,
  receivers,
  docsForVendor,
  untied,
  merge,
  onPickVendor,
  onCreateVendor,
  onRowQty,
  onAllRows,
  onUntied,
  onMerge,
  onOpenPO,
  currencyLock,
}: {
  line: RailLine;
  cap: number;
  shelves: ItemStock[];
  onDeclare: (qty: number) => void;
  onUom: (uom: string) => void;
  volumeUom: string;
  unitsReceived: (vendorCode: string | null) => { uom: string; qty: number; docs: number }[];
  familyOnReturn: (vendorCode: string) => string | null;
  lockedVendor: string | null;
  /** The return's vendor by name, for the lines whose own candidate list
   *  does not carry them: a counted line can be going back to somebody who
   *  never shipped it, and the receipts table still has to open. */
  lockedVendorName?: string | null;
  vendors: VendorOption[];
  chosen: string | null;
  receivers: DeliveryRow[];
  /** Every delivery of this part from one vendor, whoever is chosen. What the
   *  vendor rows open onto. */
  docsForVendor: (vendorCode: string) => DeliveryRow[];
  untied: boolean;
  merge: boolean;
  onPickVendor: (vendorCode: string) => void;
  /** Opens partner creation. A vendor the master does not carry is a record
   *  that has to be made there, not a name typed onto this return. */
  onCreateVendor: () => void;
  onRowQty: (grnNumber: string, qty: number) => void;
  onAllRows: (on: boolean) => void;
  /** Open a purchase order in the ordering module. */
  onOpenPO?: ((poNumber: string) => void) | undefined;
  /** The currency a vendor's return is already in: the PO currency of a
   *  receipt picked for it. A receipt from a PO in another currency can't
   *  join; it goes on a separate return (app/currency/returnCurrency.ts). */
  currencyLock?: ((vendorCode: string) => string | null) | undefined;
  onUntied: (next: boolean) => void;
  onMerge: (next: boolean) => void;
  /** Which question this render is answering. A counted line's two panels used
   *  to be tabs of one card; they are steps now, so the step picks. */
  stage: Exclude<ConfigureStage, 'items' | 'search'>;
}) {
  const [showAllVendors, setShowAllVendors] = useState(false);
  /** Typing here is asking for somebody not in the six. The list is ranked, so
   *  the six on screen are the six most likely, and everyone else was reachable
   *  only by counting through forty rows behind a Show-more link. */
  const [vendorQuery, setVendorQuery] = useState('');
  const [localTab, setTab] = useState<'vendor' | 'docs'>('vendor');
  // The step is the tab. The state stays because the auto-switch below still
  // writes to it, and because a single-panel step is one line away from being
  // a tabbed card again if the split is ever undone.
  const tab: 'vendor' | 'docs' =
    stage === 'vendor' ? 'vendor' : stage === 'receivers' ? 'docs' : localTab;
  // Only the receipts open onto anything. A vendor row used to open onto its
  // own documents, which put the next step's list on this step's screen.
  const [openDocs, setOpenDocs] = useState<Set<string>>(() => new Set());
  /** The receipt whose detail is open. A row used to be a hover state and a
   *  set of ticks; a receiving document is a record somebody needs to read
   *  -- when it landed, who signed for it, what else came with it -- before
   *  they can say a credit reverses it. */
  const [openReceipt, setOpenReceipt] = useState<DeliveryRow | null>(null);
  /** Narrows the table. A part with a hundred and twenty deliveries is not a
   *  list somebody scrolls: they know the document, or the order, or the day. */
  const [docQuery, setDocQuery] = useState('');
  /** Which page of documents is on screen. Back to the first whenever the
   *  list underneath it changes, so a search never lands on page four of a
   *  result that has one page. */
  const [docPage, setDocPage] = useState(0);
  useEffect(() => {
    setDocPage(0);
  }, [docQuery, line.key, chosen]);

  /** The documents in view. A tie is a figure against a row, so "selected" is
   *  simply the rows carrying one. */
  /** Documents stay where they are.
   *
   *  Chosen rows used to be lifted to the top of the list, which meant the
   *  document somebody had just answered moved out from under the cursor and
   *  the one they were about to answer took its place. A receipt list has an
   *  order of its own -- newest delivery first -- and that order is what makes
   *  a row findable twice. */

  const docNeedle = docQuery.trim().toLowerCase();
  /** One list, in delivery order.
   *
   *  The two tabs put what you had just done behind a click: tick a document
   *  and it left the list you were reading. Everything is in one list now, and
   *  it holds still -- a row answered is a row that stays where it was. */
  const shownReceivers = receivers
    .filter(
      (r) =>
        !docNeedle ||
        r.grnNumber.toLowerCase().includes(docNeedle) ||
        r.poNumber.toLowerCase().includes(docNeedle) ||
        (r.date ?? '').includes(docNeedle) ||
        r.vendorName.toLowerCase().includes(docNeedle),
    )
    .slice();
  const pickedCount = receivers.filter((r) => r.coming > 0).length;

  const flip = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  // Nothing to choose when the vendor came in with the return, so the
  // documents are what there is to look at.
  useEffect(() => {
    if (lockedVendor) {
      setTab('docs');
      return;
    }
    if (!chosen) setTab('vendor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, lockedVendor]);

  const declared = line.qty;
  const vendor = vendors.find((v) => v.vendorCode === chosen);
  /** Who this line is going back to, by name, whether or not they are on
   *  its own candidate list. The list is whoever shipped the part, so a
   *  plain line sent back to the vendor the serials named was not on it,
   *  and the whole receipts table was hidden on the strength of a lookup
   *  that failed. */
  const vendorName = vendor?.vendorName ?? (chosen ? lockedVendorName ?? chosen : null);
  const tied = receivers.reduce((n, r) => n + r.coming, 0);
  /** Who this line is actually going back to. A counted line answered vendor
   *  by vendor -- or answered at once by returning everything from everybody
   *  -- is settled with several of them, and then no single vendor can head
   *  this card or be measured against the whole line. The documents are every
   *  vendor's, so the table says whose each one is. */
  const owners = [...new Set(receivers.filter((r) => r.coming > 0).map((r) => r.vendorCode))];
  const multiVendor = owners.length > 1;
  const short = Math.round((declared - tied) * 100) / 100;
  const settled = untied || (declared > 0 && short === 0);

  /** Nobody on file ever shipped this part.
   *
   *  Stock counted in at a stocktake, or carried over from a migration: it is
   *  in the building with no receiver behind it. The list is then the whole
   *  book rather than a shortlist, because a return still goes to somebody and
   *  only a person knows who. */
  const unsourced = vendors.length > 0 && vendors.every((v) => v.lifetime <= 0);

  // A vendor's volumes are counted in the unit the part is received in. Write
  // the line on another shelf and the two figures stop being comparable: 15
  // pallets against 146 eaches is not a shortfall, it is two different
  // questions, so the coverage reading is withheld rather than guessed.
  //
  // Strictly about units. Folding `unsourced` in here silenced the shortfall
  // reading, which was right, but it also fired the unit-mismatch explanation
  // below on a line whose units match perfectly -- a true sentence about the
  // wrong thing. The coverage ranking takes `unsourced` separately.
  const comparable = volumeUom === line.uom;

  // What the vendor could possibly take back. Beyond it the return is not
  // short of ties, it is asking for something that never arrived.
  const impossible =
    comparable && !unsourced && !multiVendor && vendor !== undefined && declared > vendor.lifetime;

  const RECENT = 6;
  // A branch of a company already on this return comes first, always. It is the
  // one candidate whose choice changes the shape of the return -- pick it and
  // the two lines can share one RMA -- and ranking it by volume like anybody
  // else buried it behind "show more", where the decision could not be found.
  // A branch whose sibling is also on this part's list comes first, and the two
  // of them stay together. They are the only pair of candidates whose choice
  // changes the shape of the return -- send one line to each and the two can
  // share one RMA -- and ranking them by volume like anybody else left one of
  // them behind "show more", where the decision could not be found. A branch of
  // a company already on the return sorts above even those.
  const pairs = new Set(
    vendors
      .map((v) => v.familyCode)
      .filter((code, i, all): code is string => !!code && all.indexOf(code) !== i),
  );
  const rank = (v: VendorOption) =>
    (familyOnReturn(v.vendorCode) ? 2 : 0) + (v.familyCode && pairs.has(v.familyCode) ? 1 : 0);
  const ranked = [...vendors].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(b) - rank(a);
    // Siblings adjacent, so the pair reads as a pair.
    if (a.familyCode && a.familyCode === b.familyCode) {
      return a.vendorName.localeCompare(b.vendorName);
    }
    return b.recent - a.recent || b.lifetime - a.lifetime;
  });
  // Whoever could actually take this much back leads the list. A vendor who
  // has only ever shipped a fraction of what is going back is not a candidate
  // for it, and offering them at the same weight as the rest asks the user to
  // do the arithmetic the screen already has. They stay reachable, because a
  // return can be somebody's whether or not the master agrees.
  const able = ranked.filter((v) => unsourced || !comparable || v.lifetime >= declared);
  const unable = ranked.filter((v) => !unsourced && comparable && v.lifetime < declared);
  // A search is not a page of a ranked list, it is a question about the whole
  // book: typing "kell" and being shown nothing because Kellerman sits below
  // the fold would read as Kellerman not existing. So a query searches every
  // candidate, ranked order kept, and the Show-more link stands down while it
  // has something in it.
  const vendorNeedle = vendorQuery.trim().toLowerCase();
  const matches = [...able, ...unable].filter(
    (v) =>
      v.vendorName.toLowerCase().includes(vendorNeedle) ||
      v.vendorCode.toLowerCase().includes(vendorNeedle),
  );
  const shownVendors = vendorNeedle
    ? matches
    : showAllVendors
      ? [...able, ...unable]
      : able.slice(0, RECENT);

  // Whether the chosen deliveries came from more than one of the vendor's
  // sites, which is the only grouping question a counted return has.
  const inUse = receivers.filter((r) => r.coming > 0);
  const sites = [...new Set(inUse.map((r) => r.originName ?? '').filter(Boolean))];

  /** The documents in view, gathered under the vendor that raised them. */
  /** Ten documents at a time.
   *
   *  A part received forty times put forty rows under a question about one of
   *  them, and the answer to it was somewhere in the scroll. The page is the
   *  unit of reading; the figures underneath it count the whole list, because
   *  what is tied is a fact about the return rather than about the page it was
   *  typed on. */
  const docPageStart = docPage * DOCS_PER_PAGE;
  const pagedReceivers = shownReceivers.slice(docPageStart, docPageStart + DOCS_PER_PAGE);
  const docPageCount = Math.max(1, Math.ceil(shownReceivers.length / DOCS_PER_PAGE));

  const docGroups: [string, DeliveryRow[]][] = [];
  pagedReceivers.forEach((r) => {
    const at = docGroups.find(([code]) => code === r.vendorCode);
    if (at) at[1].push(r);
    else docGroups.push([r.vendorCode, [r]]);
  });

  /** One document. Pulled out of the table so the rows can be laid down
   *  flat or under a head per vendor without the row being written twice. */
  const renderDocRow = (r: DeliveryRow) => {
                  const used = r.coming > 0;
                  // One return, one currency: once a receipt is picked, one from
                  // a PO in another currency goes on a separate return.
                  const docCurrency = poCurrency(r.poNumber);
                  const lock = currencyLock?.(r.vendorCode) ?? null;
                  const blocked = !used && !!lock && lock !== docCurrency;
                  const row = (
                    <div
                      key={r.grnNumber}
                      aria-disabled={blocked || undefined}
                      className={`border-b border-border last:border-b-0 transition-colors ${
                        used ? 'bg-blue-50/40' : 'bg-white'
                      } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`flex min-h-[56px] items-center gap-2 pl-4 pr-4 ${
                          used ? '' : 'hover:bg-[#FAFBFC]'
                        }`}
                      >
                        {/* Every row here opened onto the same vendor, which
                            is now standing at the top of the card. A chevron
                            per document that says what the header says is a
                            gesture with nothing behind it. */}
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Checkbox
                            checked={used}
                            disabled={blocked}
                            onCheckedChange={(next) => {
                              onRowQty(r.grnNumber, next === true ? r.received : 0);
                              // The tick is a finished answer, so the list
                              // takes its new order from it straight away.
                            }}
                            aria-label={`Unwind ${r.grnNumber}`}
                          />
                          <span
                            className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-md border ${
                              used
                                ? 'border-primary/30 bg-blue-50 text-primary'
                                : 'border-border bg-slate-50 text-slate-400'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                          </span>
                          {/* The document names itself, and the order it
                              came in on and the day it landed sit under it.
                              They were a 10px tail beside the number, which
                              is the size a footnote is set in, for the two
                              facts somebody actually recognises a delivery
                              by. */}
                          <div className="min-w-0">
                            {/* Both of them open. A receipt is a record, not
                                a label: which day it landed, who signed for
                                it and what else came with it are the facts
                                somebody checks before saying a credit
                                reverses it, and a hover state cannot hold
                                them. */}
                            <button
                              type="button"
                              onClick={() => setOpenReceipt(r)}
                              aria-label={`Open ${r.grnNumber}`}
                              className="block max-w-full truncate text-left text-[13px] text-primary tabular-nums underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                              style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                            >
                              {highlight(r.grnNumber, docQuery.trim())}
                            </button>
                            <span className="mt-[3px] flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-slate-500">
                              {onOpenPO ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenPO(r.poNumber)}
                                  aria-label={`Open purchase order ${r.poNumber}`}
                                  className="inline-flex min-w-0 items-center gap-0.5 truncate text-[11px] text-primary tabular-nums underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                                  style={{ fontWeight: 500 }}
                                >
                                  PO {highlight(r.poNumber, docQuery.trim())}
                                  <ArrowUpRight className="w-3 h-3 shrink-0 text-blue-300" />
                                </button>
                              ) : (
                                <span className="truncate tabular-nums" style={{ fontWeight: 500 }}>
                                  PO {highlight(r.poNumber, docQuery.trim())}
                                </span>
                              )}
                              {/* The PO's currency: "PO 11151 · GBP". */}
                              <span className="shrink-0 text-slate-300">·</span>
                              <span className="shrink-0 tabular-nums text-slate-600" style={{ fontWeight: 600 }}>
                                {docCurrency}
                              </span>
                              {r.date && (
                                <>
                                  <span className="shrink-0 text-slate-300">·</span>
                                  <span className="shrink-0 tabular-nums whitespace-nowrap">
                                    Received {highlight(formatDate(r.date), docQuery.trim())}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <span
                          className="w-[100px] shrink-0 text-right text-[13px] text-slate-600 tabular-nums whitespace-nowrap"
                          style={{ fontWeight: 500, letterSpacing: '-0.01em' }}
                        >
                          {formatQty(r.received)}{' '}
                          <span className="text-[11px] text-slate-400">{line.uom}</span>
                        </span>
                        <div className={`ml-6 flex w-[110px] shrink-0 items-center ${blocked ? 'pointer-events-none' : ''}`}>
                          {/* No tie may claim more than its delivery carried. */}
                          <TieQtyInput
                            value={r.coming}
                            max={r.received}
                            uom={line.uom}
                            ariaLabel={`Quantity tied to ${r.grnNumber}`}
                            onChange={(n) => onRowQty(r.grnNumber, n)}
                            className="h-8 w-[72px] rounded-md border border-border bg-white px-2 text-right text-[13px] text-foreground tabular-nums outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </div>
                      </div>

                    </div>
                  );
                  if (!blocked) return row;
                  return (
                    <Tooltip key={r.grnNumber}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-[11px]">
                        {otherCurrencyReason(docCurrency)}
                      </TooltipContent>
                    </Tooltip>
                  );
  };

  return (
    <>
      {/* Who is taking it back, and what the credit unwinds. The card this
          used to sit inside asked for the figure; the rail asks it now, so
          this is the panel's own card rather than the lower half of one. */}
      {declared > 0 && (
        <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {/* A tab strip of one is not a choice. Where the vendor came in
              with the return there is nothing to switch to, so the card is
              headed rather than tabbed. */}
          {/* The panel names itself. A tab strip of one is not a choice, and
              the step above it has already said which question this is. */}
          {/* On the receipts tab the card is headed by the vendor itself, in
              the card the step before it picked them in: a screen of document
              numbers with a quantity on each says nothing about who is being
              settled with, and that is the one fact every row here depends
              on. The count moves down to the column head, where the documents
              are. */}
          {tab === 'docs' && multiVendor ? (
            /* Several vendors, so the head is the return rather than one of
               them: a card naming Ardmore over a table of thirteen vendors'
               documents says the whole credit is theirs. */
            <div className="flex items-center gap-3 border-b border-border bg-white px-4 py-3">
              <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary shadow-sm">
                <Building2 className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13px] text-foreground"
                  style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                >
                  {owners.length} vendors
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  Every vendor this line goes back to, with the documents each credit reverses
                </span>
              </span>
              <span
                className="shrink-0 pl-3 text-right text-[13px] text-slate-600 tabular-nums whitespace-nowrap"
                style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                {formatQty(tied)} {line.uom}
              </span>
            </div>
          ) : tab === 'docs' && vendor && !lockedVendor ? (
            /* Only where the step is not already headed by them. The return
               carries one vendor now and the header across the top says who,
               so a card repeating it under that header is the same sentence
               twice. */
            <div className="flex items-center gap-3 border-b border-border bg-white px-4 py-3">
              <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary shadow-sm">
                <Building2 className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13px] text-foreground"
                  style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                >
                  {vendor.vendorName}
                </span>
                {vendorAddress(vendor.vendorCode) && (
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{vendorAddress(vendor.vendorCode)}</span>
                  </span>
                )}
              </span>
              {/* The figure, set the way the vendor rows on the step before
                  set it: the number and its unit, and no caption repeating
                  what a column of them already means. */}
              <span
                className="shrink-0 pl-3 text-right text-[13px] text-slate-600 tabular-nums whitespace-nowrap"
                style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                {formatQty(vendor.lifetime)} {volumeUom}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-3">
              {tab === 'vendor' ? (
                <Building2 className="w-4 h-4 shrink-0 text-primary" />
              ) : (
                <FileText className="w-4 h-4 shrink-0 text-primary" />
              )}
              {/* The card is headed with the job, not with what is listed
                  under it. "Vendors" names the contents of a list; this step
                  exists to have one of them picked, so the heading is the
                  instruction, and it stays the instruction after a pick,
                  because picking a different one is the same act. */}
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                {tab === 'vendor' ? 'Select vendor' : 'Receiving documents'}
              </span>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 tabular-nums">
                {tab === 'vendor' ? vendors.length : receivers.length}
              </span>
            </div>
          )}

          {/* Where the answer stands, on the receipts tab only. On the vendor
              tab it said "Pick who is taking this line back" over a list of
              vendors with radios on them, and "No vendor yet" over a list
              nobody had picked from yet: the heading already asks, the list
              already shows, and a strip restating both is a line of grey
              between the question and the answer. The receipts tab keeps it,
              because how much of the line is tied is a number the table under
              it does not add up. */}

          {/* Above the tabs, because it is a fact about the line rather than
              about either view of it -- and it is raised off the vendor tab,
              which picking a vendor immediately moves away from, so inside it
              the warning would never be read. */}
          {/* A line written in a unit nothing ever arrived in.
           *
           *  This used to explain the rule -- volumes are in one unit, the
           *  line is in another, so it goes back untied -- and left the user
           *  holding a fact they could do nothing with. It says the plain
           *  thing now: there is nothing here to connect this to, this much
           *  of it is loose, and these are the units that do exist, with the
           *  line's unit one press from any of them. */}
          {!comparable && (
            <div className="flex flex-col gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
                <p className="min-w-0 text-[12px] leading-relaxed text-amber-800">
                  There is nothing here to connect this to. You have {formatQty(declared)}{' '}
                  {line.uom} that you haven't selected a receiving against, and no receiving
                  document is in {line.uom}: everything on file for {line.sku} arrived in{' '}
                  {volumeUom}.
                </p>
              </div>
              <UnitsOnFile
                units={unitsReceived(chosen ?? lockedVendor)}
                lineUom={line.uom}
                onUom={onUom}
              />
            </div>
          )}

          {impossible && (
            <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
              <AlertTriangle className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
              <p className="text-[12px] text-amber-800">
                {vendor!.vendorName} has only ever shipped {formatQty(vendor!.lifetime)} {line.uom}{' '}
                of this, and {formatQty(declared)} is going back. They cannot credit what they never
                sent, so either the count is wrong or some of it belongs to somebody else.
              </p>
            </div>
          )}

          {tab === 'vendor' ? (
            <>
              {/* Six rows of forty-six. The ranking puts the likely ones on
                  top, which is right, and leaves everybody else behind a link
                  that says how many rather than who. A name is the fastest
                  thing a person has when they already know the answer. */}
              <div className="border-b border-[#F1F5F9] bg-white px-4 py-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={vendorQuery}
                    onChange={(e) => setVendorQuery(e.target.value)}
                    placeholder={`Search ${vendors.length} vendors by name or code`}
                    aria-label="Search vendors"
                    className="h-8 w-full rounded-md border border-border bg-white pl-8 pr-8 text-[12px] text-foreground outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  {vendorQuery && (
                    <button
                      type="button"
                      onClick={() => setVendorQuery('')}
                      aria-label="Clear the vendor search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {shownVendors.length === 0 && (
                <p className="px-4 py-6 text-center text-[12px] text-slate-500">
                  {vendorNeedle
                    ? `No vendor matches "${vendorQuery.trim()}". Clear the search, or add the vendor.`
                    : `No vendor on file has shipped ${formatQty(declared)} ${line.uom} of this item. Show the rest to select one anyway, or add a vendor.`}
                </p>
              )}

              <div className="flex flex-col divide-y divide-[#F1F5F9]">
                {shownVendors.map((v) => {
                  const picked = v.vendorCode === chosen;
                  return (
                    <div key={v.vendorCode} className={picked ? 'bg-blue-50/60' : ''}>
                      <div
                        className={`flex items-center gap-2 pl-4 pr-4 transition-colors ${
                          picked ? '' : 'hover:bg-[#FAFBFC]'
                        }`}
                      >
                        {/* The chevron here opened this vendor's nine
                            receiving documents inside the vendor list, which
                            put the next step's question on this one. What a
                            vendor shipped this on is stated on the row and
                            listed in full one step later, where it can also be
                            edited. */}
                        {/* A div rather than a button, because the
                            description under the name carries its own `more`
                            toggle and a button inside a button is neither. */}
                        <div
                          onClick={() => onPickVendor(v.vendorCode)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onPickVendor(v.vendorCode);
                            }
                          }}
                          role="radio"
                          tabIndex={0}
                          aria-checked={picked}
                          aria-label={`Send ${line.sku} back to ${v.vendorName}`}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2.5 text-left"
                        >
                          <span
                            className={`flex w-4 h-4 shrink-0 items-center justify-center rounded-full border-2 ${
                              picked ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {picked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-border bg-slate-50 text-slate-400">
                            <Building2 className="w-3 h-3" />
                          </span>
                          {/* Name and address, and nothing else.
                              
                              The description was three sentences of boilerplate
                              across the width of the row, and it is the notes
                              field of a phone contact: mostly empty in real
                              data, and no help at all in telling two partners
                              apart. The address is filled in for almost every
                              vendor and it is what somebody actually
                              recognises them by -- which Home Depot, the
                              people in Chicago. */}
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-[13px] ${picked ? 'text-primary' : 'text-foreground'}`}
                              style={{ fontWeight: 600 }}
                            >
                              {v.vendorName}
                            </span>
                            {vendorAddress(v.vendorCode) && (
                              <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                                <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{vendorAddress(v.vendorCode)}</span>
                              </span>
                            )}
                          </span>

                          {/* How much of this part they sent, on the right.
                              What they sent it on used to stand here too, and
                              the receipts are the next step's whole subject,
                              listed there in full and editable there. */}
                          {/* What can go back to this vendor, said as that
                              rather than as a bare number. "145 EA" beside a
                              partner's name is a figure nobody can place. */}
                          <span
                            className={`w-[110px] shrink-0 pl-3 text-right ${
                              comparable && !unsourced && v.lifetime < declared
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {v.lifetime > 0 ? (
                              <>
                                <span
                                  className="block text-[13px] tabular-nums whitespace-nowrap"
                                  style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                                >
                                  {formatQty(v.lifetime)} {volumeUom}
                                </span>
                                <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">
                                  available to return
                                </span>
                              </>
                            ) : (
                              // `0 EA` is arithmetic where a sentence belongs.
                              // What the row has to say is that this vendor is
                              // a choice being made by hand, not one the
                              // paperwork supports.
                              <span className="block text-[11px] text-slate-500">
                                Has not shipped this item
                              </span>
                            )}
                          </span>
                        </div>

                        {/* A branch of a company already on this return used
                            to be flagged here. The Merge and split step asks
                            that question in full, with both vendors on screen,
                            so the flag was a warning about a step that has
                            not been reached. The ordering still knows: those
                            branches sort to the top. */}
                      </div>

                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#F1F5F9] bg-[#FAFBFC] px-4 py-2">
                {vendorNeedle ? (
                  <span className="text-[11px] text-slate-500">
                    {shownVendors.length} of {vendors.length}{' '}
                    {vendors.length === 1 ? 'vendor' : 'vendors'} match
                  </span>
                ) : unable.length > 0 || able.length > RECENT ? (
                  <button
                    type="button"
                    onClick={() => setShowAllVendors((v) => !v)}
                    className="text-[11px] text-slate-500 transition-colors hover:text-primary"
                    style={{ fontWeight: 600 }}
                  >
                    {showAllVendors
                      ? 'Show only who can cover it'
                      : unable.length > 0
                        ? `Show ${unable.length} who cannot cover ${formatQty(declared)} ${line.uom}`
                        : `Show ${able.length - RECENT} more vendors`}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    {ranked.length === 0
                      ? lockedVendor && lockedVendorName
                        ? `This return goes back to ${lockedVendorName}, and they have no record of receiving ${line.sku}.`
                        : 'No vendor on file has shipped this item.'
                      : lockedVendor
                        ? 'One return goes back to one vendor, so this is the only choice on this line.'
                        : 'Not one of these? Add a new vendor.'}
                  </span>
                )}
                {/* A vendor the master does not carry is a partner record
                    that does not exist yet, not a name to be typed onto this
                    return. Writing one here made a supplier the rest of the
                    system has never heard of. It goes to partner creation, in
                    its own tab, so the return keeps its place. */}
                {!lockedVendor && (
                  <button
                    type="button"
                    onClick={onCreateVendor}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[12px] text-primary transition-colors hover:bg-blue-100"
                    style={{ fontWeight: 600 }}
                  >
                    <Plus className="w-3 h-3" />
                    Add a new vendor
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </>
          ) : !chosen && !lockedVendor && !multiVendor ? null : (
            <>
              {/* Nothing to reverse is a legitimate answer and an expensive
                  one, and what it costs is not something anybody should have
                  to infer. The quantity says how much of the line is loose;
                  the impact says what happens to it on the invoicing side,
                  where a return with no receiver behind it does not unwind. */}
              {(untied || (short > 0 && receivers.length > 0)) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <p className="min-w-0 flex-1 text-[12px] text-amber-800">
                    You have {formatQty(untied ? declared : short)} {line.uom} that you haven't
                    selected a receiving against.
                  </p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 text-[12px] text-amber-900 underline decoration-amber-400 underline-offset-2 transition-colors hover:text-amber-950"
                        style={{ fontWeight: 600 }}
                      >
                        Click here to view impact
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" side="bottom" className="w-[340px] p-0 z-[400]">
                      <div className="border-b border-border px-3.5 py-2.5">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                          What happens without a receiving document
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 px-3.5 py-3 text-[12px] leading-relaxed text-slate-600">
                        <p>
                          A receiving document is what the credit reverses. Without one, nothing
                          unwinds on the invoicing side: the bill for these{' '}
                          {formatQty(untied ? declared : short)} {line.uom} stays exactly as it is.
                        </p>
                        <p>
                          The goods still go back, and{' '}
                          {multiVendor ? 'each vendor' : (vendorName ?? 'the vendor')} still owes
                          the money. It arrives as a credit sitting loose on their account, and
                          somebody has to match it to an invoice by hand before it is worth
                          anything.
                        </p>
                        <p className="text-slate-500">
                          Selecting the deliveries they came in on does that matching now, while
                          the flow still knows which they were.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Why this step exists at all, on the one kind of line that
                  has to answer it by hand. A serial carries the receipt it
                  arrived on and a lot carries its delivery, so those lines
                  are tied for you; a counted part carries nothing, and one
                  bolt is any bolt. */}
              {!untied && receivers.length > 0 && (
                <div className="flex items-start gap-2 border-b border-[#E8ECF1] bg-[#F7F9FC] px-4 py-2.5">
                  <Info className="mt-px w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    {/* It called every untied line non-serialized, including
                        lot-tracked ones, which is a different kind of part
                        and says something untrue about the one on screen. */}
                    {isLotMode(line.trackingMode)
                      ? `Lots on ${line.sku} don't record which delivery they came from.`
                      : `${line.sku} isn't tracked by serial or lot, so nothing on it records which delivery it came from.`}{' '}
                    Select the receiving documents to return against.
                  </p>
                </div>
              )}
              {receivers.length === 0 ? (
                /* An empty table is the one place this actually bites, so it
                   is a warning here rather than a grey sentence under a list
                   that never appeared -- and it says nothing at all when the
                   unit warning above the tabs has already said it, which was
                   the same paragraph twice down one panel. */
                !comparable ? null : (
                <div className="flex flex-col gap-2.5 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-px w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <p className="min-w-0 text-[12px] leading-relaxed text-amber-800">
                      {vendorName ?? 'This vendor'} has no delivery of {line.sku} in {line.uom} on
                      file, so there is nothing for the credit to reverse and it goes back untied.
                    </p>
                  </div>
                  <UnitsOnFile
                    units={unitsReceived(chosen ?? lockedVendor)}
                    lineUom={line.uom}
                    onUom={onUom}
                  />
                </div>
                )
              ) : (
                <div className={untied ? 'pointer-events-none opacity-40' : ''}>
                  {/* Selected and not selected, as two lists rather than one
                      long one with the answers scattered through it. The whole
                      history of a part is on this table now, so what has been
                      chosen has to be readable without hunting for the ticks;
                      a document moves from one tab to the other as it is
                      taken. */}
                  <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-2.5">
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={docQuery}
                        onChange={(e) => setDocQuery(e.target.value)}
                        placeholder="Search by document or PO number"
                        aria-label="Search receiving documents by document or PO number"
                        className="h-8 w-full rounded-md border border-[#E8ECF1] bg-white pl-8 pr-7 text-[12px] text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                      />
                      {docQuery && (
                        <button
                          type="button"
                          onClick={() => setDocQuery('')}
                          aria-label="Clear the document search"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Column heads are labels, so they are set as labels:
                      10px, uppercase, tracked out, and quiet. They were the
                      same size and weight as the document numbers under them,
                      which made the head read as the first row. */}
                  <div className="flex h-9 items-center border-b border-border bg-[#FAFBFC] pl-10 pr-4">
                    <span
                      className="flex flex-1 items-center text-[10px] uppercase text-slate-400"
                      style={{ fontWeight: 600, letterSpacing: '0.06em' }}
                    >
                      Receiving document
                      <span className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-border bg-white px-1.5 text-[10px] text-slate-500 tabular-nums tracking-normal">
                        {shownReceivers.length}
                      </span>
                    </span>
                    <span
                      className="w-[100px] shrink-0 text-right text-[10px] uppercase text-slate-400"
                      style={{ fontWeight: 600, letterSpacing: '0.06em' }}
                    >
                      Received
                    </span>
                    <span
                      className="ml-6 w-[110px] shrink-0 text-left text-[10px] uppercase text-slate-400"
                      style={{ fontWeight: 600, letterSpacing: '0.06em' }}
                    >
                      To return
                    </span>
                  </div>
                  {shownReceivers.length === 0 && (
                    <p className="px-4 py-6 text-center text-[12px] text-slate-500">
                      {docNeedle
                        ? `Nothing matches "${docQuery.trim()}" in this list.`
                        : 'No delivery of this item is on file for this vendor.'}
                    </p>
                  )}
                  {/* Grouped whenever the list spans more than one of them,
                      not only when more than one is being credited: the whole
                      history of the part is in this table, so an ungrouped
                      Not-selected tab is twelve other vendors' documents with
                      nothing saying so. */}
                  {docGroups.length > 1
                    ? docGroups.map(([code, rows]) => (
                        <div key={code}>
                          {/* Whose documents these are. Thirteen vendors'
                              receipts in one list read as one vendor's until
                              the list says otherwise. */}
                          <div className="flex items-center gap-2 border-b border-border bg-[#F4F7FB] px-4 py-2">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span
                              className="min-w-0 flex-1 truncate text-[12px] text-slate-600"
                              style={{ fontWeight: 600 }}
                            >
                              {highlight(rows[0]?.vendorName ?? code, docQuery.trim())}
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                              {rows.length} {rows.length === 1 ? 'document' : 'documents'}
                              {rows.some((d) => d.coming > 0)
                                ? ` · ${formatQty(rows.reduce((n, d) => n + d.coming, 0))} ${line.uom}`
                                : ''}
                            </span>
                          </div>
                          {rows.map(renderDocRow)}
                        </div>
                      ))
                    : pagedReceivers.map(renderDocRow)}
                  {/* The pager, only once there is a second page to reach. */}
                  {docPageCount > 1 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border bg-[#FAFBFC] px-4 py-2.5">
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {docPageStart + 1} to {Math.min(docPageStart + DOCS_PER_PAGE, shownReceivers.length)} of{' '}
                        {shownReceivers.length} documents
                      </span>
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={docPage === 0}
                          onClick={() => setDocPage((n) => Math.max(0, n - 1))}
                          aria-label="Previous page of receiving documents"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8ECF1] bg-white px-2 text-[11px] text-slate-600 transition-colors hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ fontWeight: 600 }}
                        >
                          <ChevronLeft className="w-3 h-3" />
                          Previous
                        </button>
                        <span className="px-1 text-[11px] text-slate-500 tabular-nums">
                          {docPage + 1} / {docPageCount}
                        </span>
                        <button
                          type="button"
                          disabled={docPage >= docPageCount - 1}
                          onClick={() => setDocPage((n) => Math.min(docPageCount - 1, n + 1))}
                          aria-label="Next page of receiving documents"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8ECF1] bg-white px-2 text-[11px] text-slate-600 transition-colors hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ fontWeight: 600 }}
                        >
                          Next
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* The receipt itself, in the vendor-invoicing modal that
                  already reads one: header, dates, who signed for it, and
                  every line that came in on it. */}
              {openReceipt && (
                <ReceivingDocumentModal
                  open
                  onOpenChange={(next) => {
                    if (!next) setOpenReceipt(null);
                  }}
                  grnNumber={openReceipt.grnNumber}
                  vendorName={openReceipt.vendorName}
                  poRef={openReceipt.poNumber}
                  receivedDate={openReceipt.date}
                  receivedBy={receivedByFor(openReceipt.grnNumber)}
                  lines={receiptLines(openReceipt)}
                  // A purchase order can arrive across several deliveries,
                  // so a receipt that carries part of one is partial rather
                  // than short.
                  status={(() => {
                    const rows = receiptLines(openReceipt);
                    const ordered = rows.reduce((n, l) => n + l.orderedQty, 0);
                    const got = rows.reduce((n, l) => n + l.receivedQty, 0);
                    return got >= ordered ? 'Received' : 'Partial';
                  })()}
                />
              )}

            </>
          )}
        </div>
      )}
    </>
  );
}
