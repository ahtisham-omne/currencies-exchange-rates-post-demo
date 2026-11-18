/**
 * Step two: the return, grouped by who is taking it back.
 *
 * This is `AddressConflictPanel` lifted out of the shipment wizard --
 * `shipment-details-page/src/list/components/create-shipment-wizard.tsx:3637`
 * -- with its markup kept as it stands there and only the data it reads
 * swapped. An address becomes a company, a sales order becomes one of its
 * branches, and the line items become the shares of this return that are
 * theirs.
 *
 * Two blocks of the source are dropped rather than translated, because a
 * return has nothing behind them: the departure / carrier resolver, and the
 * Google-autocomplete "different address" entry. What is left of the merge
 * tile -- its own header band over a list of destination rows -- is the
 * branch picker, which is exactly the shape of the question here.
 *
 * One rule the shipment wizard does not have. It will merge any addresses you
 * like, because a shipment has no opinion about who is party to it. An RMA is
 * raised against one vendor and credited by them, so merging is offered only
 * between branches of the same company. Two unrelated vendors stay two RMAs
 * and are not offered the choice.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  MapPin,
  Package,
  Trash,
  X,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/lib/itemImages';
import { longDescriptionFor } from '@/app/components/VendorSelectionItemCell';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { ReturnVendorUomInput } from '@/app/components/rma/ReturnVendorUomInput';
import { TRACKING_CHIP, TRACKING_LABELS,
  type TrackingMode,
} from '@/app/data/itemProvenance';
import { VendorDescription } from '@/app/components/rma/VendorDescription';
import { possessive } from '@/app/lib/possessive';

export interface VendorStepItem {
  sku: string;
  description: string;
  uom: string;
  qty: number;
  /** Everything received, the ceiling on an edit. */
  cap: number;
  /** How much of this share is tied to a receiving document. */
  tied: number;
  /** How many documents the credit reverses. */
  docs: number;
  trackingMode: TrackingMode;
}

export interface VendorStepLeg {
  vendorCode: string;
  vendorName: string;
  /** The vendor in one line, which is what the card says about them under
   *  their name. It carried the branch's share and its vendor code there
   *  before: the share is on the line-items button beside it and the code is
   *  an identifier nobody on this step is matching against. */
  description?: string | undefined;
  familyCode?: string | undefined;
  familyName?: string | undefined;
  items: VendorStepItem[];
}

/** The source's `LineItemThumbnail`: a 36px rounded-lg tile on slate-50 with
 *  a zoom cursor, tinting its border to primary/40 and scaling the image on
 *  hover, opening a preview card. */
function LineItemThumbnail({ sku, description }: { sku: string; description: string }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div
          className="rounded-lg border border-border bg-slate-50 overflow-hidden shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img"
          style={{ width: 40, height: 40 }}
        >
          <ImageWithFallback
            src={imageForSku(sku)}
            alt={sku}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/5">
              <ImageWithFallback
                src={imageForSku(sku)}
                alt={sku}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-white font-mono truncate" style={{ fontWeight: 600 }}>
                {sku}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white px-4 py-3 space-y-2">
          <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">
            {longDescriptionFor(sku, description)}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** One card on the left: a company, and the branches of it in this return. */
interface Group {
  key: string;
  name: string;
  familyCode: string | undefined;
  legs: VendorStepLeg[];
}

export function ReturnVendorStep(p: {
  legs: VendorStepLeg[];
  /** Family code to the branch everything is going to. Absent means split. */
  merges: Record<string, string>;
  /** Lines that never got a vendor, and so are not on the return. */
  left: { sku: string; description: string }[];
  onMerge: (familyCode: string, vendorCode: string | null) => void;
  onQty: (sku: string, vendorCode: string, qty: number) => void;
  onBackToItem: (sku: string) => void;
}) {
  // Step 2 does not expand the branch cards inline - the line-items table
  // lives in a modal opened by the per-branch "RMA Line Items" button.
  const [viewLineItemsVendor, setViewLineItemsVendor] = useState<string | null>(null);
  const viewLeg = useMemo(
    () =>
      viewLineItemsVendor
        ? p.legs.find((l) => l.vendorCode === viewLineItemsVendor) ?? null
        : null,
    [viewLineItemsVendor, p.legs],
  );
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(() => new Set());
  const toggleDescription = (sku: string) =>
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });

  const legsByCompany = useMemo(() => {
    const m = new Map<string, Group>();
    p.legs.forEach((leg) => {
      const key = leg.familyCode ?? leg.vendorCode;
      const found = m.get(key);
      if (found) found.legs.push(leg);
      else
        m.set(key, {
          key,
          name: leg.familyName ?? leg.vendorName,
          familyCode: leg.familyCode,
          legs: [leg],
        });
    });
    return m;
  }, [p.legs]);

  const groups = [...legsByCompany.values()];
  const conflicts = groups.filter((g) => g.familyCode && g.legs.length > 1);
  const anyMerged = conflicts.some((g) => p.merges[g.familyCode!]);
  const documents = groups.reduce(
    (n, g) => n + (g.familyCode && p.merges[g.familyCode] ? 1 : g.legs.length),
    0,
  );

  return (
    <>
      {/* The step body already insets this panel, so the 24px the source
          carried on each side doubled it -- 48px of margin on a screen that
          wants the width for two columns. Vertical rhythm stays. */}
      <div style={{ padding: '4px 0 20px' }}>
        {/* Yellow callout - spans full width across both columns */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '14px 16px',
            borderRadius: 10,
            backgroundColor: conflicts.length > 0 ? '#FFFBEB' : '#F8FAFC',
            border: `1px solid ${conflicts.length > 0 ? '#FDE68A' : '#E2E8F0'}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: conflicts.length > 0 ? '#FEF3C7' : '#EFF6FF',
              border: `1px solid ${conflicts.length > 0 ? '#FDE68A' : '#DBEAFE'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle
              style={{
                width: 18,
                height: 18,
                color: conflicts.length > 0 ? '#B45309' : '#0A77FF',
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: conflicts.length > 0 ? '#78350F' : '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              {conflicts.length > 0
                ? `${conflicts.length === 1 ? 'One company' : `${conflicts.length} companies`} on this return ${conflicts.length === 1 ? 'has' : 'have'} more than one branch`
                : `This return creates ${documents === 1 ? 'one RMA' : `${documents} RMAs`}`}
            </div>
            <div
              style={{
                fontSize: 12,
                color: conflicts.length > 0 ? '#92400E' : '#64748B',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              An RMA is raised against one vendor. Review each branch's line items, then select
              whether to keep them separate or merge them.
            </div>
          </div>
        </div>

        {/* Two-column layout: vendors on the left, resolution sidebar on the
            right. Sidebar becomes sticky on wide screens so the resolution
            stays visible while the user scrolls the cards. */}
        {/* 24px between the columns was too little once the branch cards
            grew a description: the text ran up to the sidebar and the two
            columns read as one crowded block. 40px separates them. */}
        <div className="grid gap-10 mt-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 420px' }}>
          {/* LEFT - RMA vendors */}
          <div className="min-w-0">
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 12,
              }}
            >
              RMA vendors
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groups.map((group) => {
                const merged = group.familyCode ? p.merges[group.familyCode] : undefined;
                const lines = group.legs.reduce((n, l) => n + l.items.length, 0);
                // One branch is not a company with branches in it. Wrapping it
                // in a header that repeats its own name, over a card that is
                // the only thing inside, said the same vendor twice and
                // implied a grouping choice that cannot exist for one.
                const solo = group.legs.length === 1;
                return (
                  <div
                    key={group.key}
                    className={
                      solo ? '' : 'rounded-xl border border-slate-200 bg-white overflow-hidden'
                    }
                  >
                    {/* Company header - partner-style: name on the left, and
                        the "line items on this company" stat chip on the
                        right (reuses step 1's chip container). */}
                    {!solo && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* The company. Building2 on the light blue tile, the
                            way a vendor is drawn everywhere else in this
                            flow. */}
                        <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center text-primary flex-shrink-0">
                          <Building2 className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[13px] text-slate-900 truncate"
                            style={{ fontWeight: 600 }}
                          >
                            {group.name}
                          </div>
                          <div
                            className="text-[12px] text-slate-500 mt-0.5 truncate"
                            style={{ fontWeight: 500 }}
                          >
                            {group.legs.length === 1
                              ? group.legs[0]!.vendorCode
                              : `${group.legs.length} branches · ${merged ? 'one RMA' : `${group.legs.length} RMAs`}`}
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border flex-shrink-0"
                        title="RMA line items returned to this company."
                      >
                        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-slate-50 text-slate-500">
                          <FileText className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span
                            className="text-[13px] tabular-nums text-foreground"
                            style={{ fontWeight: 600 }}
                          >
                            {lines}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1" style={{ fontWeight: 500 }}>
                            Line item{lines !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Nested branch cards - each branch renders as the same
                        receiver card used in step 1, minus the chevron and
                        checkbox since items are always shown and already
                        selected. */}
                    <div className={solo ? '' : 'flex flex-col gap-2.5 p-3'}>
                      {group.legs.map((leg) => {
                        const going = leg.items.reduce((n, i) => n + i.qty, 0);
                        const uoms = [...new Set(leg.items.map((i) => i.uom))];
                        const holds = merged !== undefined && merged === leg.vendorCode;
                        // The left column reflects, it does not ask. Which
                        // branch the merge is raised against is chosen in the
                        // tile on the right, and the card marks the one that
                        // was picked.
                        return (
                          <div
                            key={leg.vendorCode}
                            className={`group relative rounded-xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] transition-all ${
                              holds
                                ? 'border-primary bg-blue-50/40'
                                : 'border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            {/* Corner remove - 24×24 white circle with
                                border, small shadow, slate-400 X that tints
                                to destructive-red on hover. Sticks slightly
                                out of the card's top-right corner and only
                                surfaces while the card is hovered. */}
                            <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  leg.items.forEach((i) => p.onQty(i.sku, leg.vendorCode, 0));
                                }}
                                className="w-7 h-7 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-colors flex items-center justify-center cursor-pointer"
                                title={`Take everything off ${possessive(leg.vendorName)} RMA`}
                                aria-label={`Take everything off ${possessive(leg.vendorName)} RMA`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Branch header row - no chevron / no expand
                                interaction; the line items live in a modal
                                opened by the "RMA Line Items" button. */}
                            <div className="flex items-center gap-3 px-3.5 py-3 select-none">
                              {/* A branch, marked apart from the company above
                                  it by its own glyph rather than by weight.
                                  The pin only means anything while there is a
                                  company header over it to mean it against: a
                                  vendor standing on its own is not one of
                                  several, so it takes the company's own
                                  glyph. */}
                              <div className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-blue-50 text-primary shadow-sm">
                                {solo ? (
                                  <Building2 className="w-[18px] h-[18px]" />
                                ) : (
                                  <MapPin className="w-[18px] h-[18px]" />
                                )}
                              </div>

                              {/* And room inside the card too: the
                                  description was ending a character from the
                                  line-items button. */}
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-6">
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="text-[13px] text-gray-900 truncate"
                                      style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                                    >
                                      {leg.vendorName}
                                    </span>
                                    {/* Which branch the merge is raised
                                        against, said as a selection rather
                                        than as a sentence about paperwork.
                                        "Raises the shared RMA" and "On the
                                        Ardmore Industrial RMA" described the
                                        document; what the card has to say is
                                        that this is the branch that was
                                        picked, and the branch picker above it
                                        has already named the rest. */}
                                    {holds && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-primary"
                                        style={{ fontWeight: 700 }}
                                      >
                                        <Check className="w-2.5 h-2.5" />
                                        BRANCH SELECTED
                                      </span>
                                    )}
                                  </div>
                                  <VendorDescription
                                    text={leg.description ?? ''}
                                    name={leg.vendorName}
                                  />
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* RMA Line Items - sole card-level action.
                                      The remove affordance is the corner X. */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewLineItemsVendor(leg.vendorCode);
                                    }}
                                    className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-white text-[13px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors cursor-pointer"
                                    style={{ fontWeight: 500 }}
                                    title={`RMA line items for ${leg.vendorName}`}
                                  >
                                    <Boxes className="w-4 h-4" />
                                    RMA Line Items
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                      ({leg.items.length})
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lines nobody was named for cannot be grouped, so they are not
                on the return. Said out loud rather than dropped. */}
            {p.left.length > 0 && (
              <div className="mt-3.5 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3">
                <p className="text-[12px] text-amber-800" style={{ fontWeight: 600 }}>
                  {p.left.length} {p.left.length === 1 ? 'line is' : 'lines are'} not coming with
                  this return
                </p>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Nobody has been named to take {p.left.length === 1 ? 'it' : 'them'} back, so there
                  is no RMA {p.left.length === 1 ? 'it' : 'they'} could go on.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.left.map((l) => (
                    <button
                      key={l.sku}
                      type="button"
                      onClick={() => p.onBackToItem(l.sku)}
                      className="inline-flex items-center gap-1 rounded border border-amber-200 bg-white px-2 py-1 text-[12px] text-amber-800 transition-colors hover:bg-amber-50"
                      style={{ fontWeight: 600 }}
                    >
                      <Package className="w-3.5 h-3.5" />
                      {l.sku}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT - Resolution sidebar. Sticky on wide screens so the
              decision stays in view as the user scrolls the cards. */}
          <aside className="lg:sticky lg:self-start" style={{ top: 16, paddingTop: 27 }}>
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2.5 rounded-t-xl">
                <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center text-primary flex-shrink-0">
                  <FileText className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <div className="text-[13px] text-slate-900" style={{ fontWeight: 600 }}>
                    Resolution
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
                    {conflicts.length > 0
                      ? 'Pick how to handle multiple branches'
                      : 'Nothing to resolve on this return'}
                  </div>
                </div>
              </div>

              <div className="p-4">
                {conflicts.length === 0 ? (
                  <p className="text-[12px] text-slate-500" style={{ lineHeight: 1.4 }}>
                    Every vendor here is a company of its own, so this return becomes{' '}
                    {documents === 1 ? 'one RMA' : `${documents} RMAs`} and there is nothing to
                    combine.
                  </p>
                ) : (
                  // One decision for the whole return, the way the source
                  // carries one `resolution` for one conflict. It was a Split
                  // and a Merge tile per family, under the family's name, so a
                  // return touching two companies asked the same question
                  // twice and read as though Kellerman and Ardmore could be
                  // combined with each other. They cannot; each company's
                  // branches fold into that company.
                  <RadioGroup
                    value={anyMerged ? 'merge' : 'split'}
                    onValueChange={(v) =>
                      conflicts.forEach((g) =>
                        p.onMerge(
                          g.familyCode!,
                          v === 'merge'
                            ? p.merges[g.familyCode!] ?? g.legs[0]!.vendorCode
                            : null,
                        ),
                      )
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Split - plain radio tile. */}
                      <label
                        htmlFor="split-all"
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: 12,
                          borderRadius: 10,
                          cursor: 'pointer',
                          border: `1px solid ${!anyMerged ? '#0A77FF' : '#E2E8F0'}`,
                          backgroundColor: !anyMerged ? '#EFF6FF' : '#fff',
                          transition: 'all 150ms',
                        }}
                      >
                        <RadioGroupItem value="split" id="split-all" style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                            Split into separate RMAs
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                            Every branch raises its own, so each credits what it shipped.
                          </div>
                        </div>
                      </label>

                      {/* Merge - collapsed is a plain radio tile; selected, the
                          tile's own header becomes a section header and the
                          branch picker flows below inside the SAME tile. That
                          is `AddressConflictPanel`'s recipe, with "Choose
                          destination" reading as the branch that raises it. */}
                      {anyMerged ? (
                        <div
                          style={{
                            borderRadius: 10,
                            border: '1px solid #0A77FF',
                            backgroundColor: '#fff',
                            transition: 'all 150ms',
                          }}
                        >
                          <label
                            htmlFor="merge-all"
                            className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-3 cursor-pointer rounded-t-[10px]"
                          >
                            <RadioGroupItem value="merge" id="merge-all" style={{ marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                                Merge into one RMA
                              </div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                                {conflicts.length === 1
                                  ? `Combine all ${conflicts[0]!.legs.length} branches into a single RMA, raised against one of them.`
                                  : `Each company's branches combine into one RMA, raised against one of them.`}
                              </div>
                            </div>
                          </label>

                          <div className="p-3" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {conflicts.map((group) => (
                              <div
                                key={group.key}
                                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                              >
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: '#64748B',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  {conflicts.length === 1
                                    ? 'Choose the branch it is raised against'
                                    : `${group.name} · choose the branch`}
                                </div>
                                {group.legs.map((leg) => {
                                  const isSelected = p.merges[group.familyCode!] === leg.vendorCode;
                                  const going = leg.items.reduce((n, i) => n + i.qty, 0);
                                  const uoms = [...new Set(leg.items.map((i) => i.uom))];
                                  return (
                                    <label
                                      key={leg.vendorCode}
                                      className="flex items-start gap-3 cursor-pointer transition-colors"
                                      style={{
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1px solid ${isSelected ? '#0A77FF' : '#E2E8F0'}`,
                                        backgroundColor: isSelected ? '#EFF6FF' : '#fff',
                                        fontSize: 12,
                                        color: '#0F172A',
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="radio"
                                        name={`mergeHolder-${group.key}`}
                                        checked={isSelected}
                                        onChange={() => p.onMerge(group.familyCode!, leg.vendorCode)}
                                        aria-label={`Raise the ${group.name} RMA against ${leg.vendorName}`}
                                        style={{ accentColor: '#0A77FF', flexShrink: 0, marginTop: 3 }}
                                      />
                                      <div className="min-w-0 flex-1 leading-tight">
                                        <div
                                          className="truncate"
                                          title={leg.vendorName}
                                          style={{ fontWeight: 500, color: '#0F172A' }}
                                        >
                                          {leg.vendorName}
                                        </div>
                                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                                          {formatQty(going)} {uoms.length === 1 ? uoms[0] : 'units'} of
                                          its own · {leg.vendorCode}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor="merge-all"
                          style={{
                            display: 'flex',
                            gap: 12,
                            padding: 12,
                            borderRadius: 10,
                            cursor: 'pointer',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#fff',
                            transition: 'all 150ms',
                          }}
                        >
                          <RadioGroupItem value="merge" id="merge-all" style={{ marginTop: 2 }} />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                              Merge into one RMA
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                              {conflicts.length === 1
                                ? `Combine all ${conflicts[0]!.legs.length} branches into a single RMA, raised against one of them.`
                                : `Each company's branches combine into one RMA, raised against one of them.`}
                            </div>
                          </div>
                        </label>
                      )}
                    </div>
                  </RadioGroup>
                )}

              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Per-branch "RMA Line Items" modal - the items table that used to sit
          inline under each card. */}
      <DialogPrimitive.Root
        open={viewLeg !== null}
        onOpenChange={(o) => !o && setViewLineItemsVendor(null)}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[240] bg-black/40" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[241] w-[92vw] max-w-[900px] max-h-[82vh] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#EEF2F6] shrink-0">
              <div className="min-w-0">
                <DialogPrimitive.Title
                  className="text-[16px] text-foreground truncate"
                  style={{ fontWeight: 700 }}
                >
                  RMA Line Items
                </DialogPrimitive.Title>
                <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                  Going back to {viewLeg?.vendorName}
                </p>
              </div>
              <DialogPrimitive.Close
                className="w-9 h-9 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X className="w-[18px] h-[18px]" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-left text-[12px]">
                <thead
                  className="bg-card border-b border-border text-[12px] text-slate-500 sticky top-0 z-10"
                  style={{ fontWeight: 500 }}
                >
                  <tr className="bg-muted/30">
                    <th className="px-4 py-3 min-w-[220px] text-[12px]">Line items</th>
                    <th className="px-4 py-3 text-right w-[140px] text-[12px]">Tied to documents</th>
                    <th className="pl-16 pr-4 py-3 text-right w-[200px] text-[12px]">Quantity Coming Back</th>
                    <th className="px-2 py-3 w-[48px]" aria-label="Take off the RMA" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewLeg?.items ?? []).map((it, idx) => {
                    const displayDescription = longDescriptionFor(it.sku, it.description);
                    const isDescExpanded = expandedDescriptions.has(it.sku);
                    // The units decide a serialized share, so a figure typed
                    // here would disagree with the serial numbers on it.
                    const fixed = it.trackingMode === 'serialized';
                    return (
                      <tr
                        key={`vli-${viewLeg!.vendorCode}-${it.sku}`}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex-shrink-0 text-[12px] text-slate-400 tabular-nums w-6 text-left"
                              style={{ fontWeight: 500 }}
                            >
                              #{idx + 1}
                            </span>
                            <LineItemThumbnail sku={it.sku} description={it.description} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => p.onBackToItem(it.sku)}
                                  className="text-[13px] text-gray-900 hover:text-primary transition-colors cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                >
                                  {it.sku}
                                </button>
                                <TrackingTag mode={it.trackingMode} size="md" />
                              </div>
                              <div className="text-[12px] text-slate-500 leading-snug mt-0.5 w-full min-w-0 max-w-[320px]">
                                {isDescExpanded ? (
                                  <span className="block whitespace-normal break-words">
                                    {displayDescription}{' '}
                                    <button
                                      type="button"
                                      onClick={() => toggleDescription(it.sku)}
                                      className="inline-flex items-center gap-0.5 text-[12px] text-primary hover:text-blue-700 transition-colors cursor-pointer align-baseline"
                                      style={{ fontWeight: 500 }}
                                    >
                                      Show less <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 w-full min-w-0">
                                    <span className="truncate flex-1 min-w-0">
                                      {displayDescription}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleDescription(it.sku)}
                                      className="inline-flex items-center gap-0.5 text-[12px] text-primary hover:text-blue-700 transition-colors cursor-pointer shrink-0"
                                      style={{ fontWeight: 500 }}
                                    >
                                      more <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                            {formatQty(it.tied)}/{formatQty(it.qty)}
                            {it.uom}
                          </div>
                          {(() => {
                            let label = 'Not tied';
                            let color = '#94A3B8';
                            if (it.tied > 0 && it.tied >= it.qty) {
                              label = `${it.docs} document${it.docs === 1 ? '' : 's'}`;
                              color = '#059669';
                            } else if (it.tied > 0) {
                              label = 'Partly tied';
                              color = '#D97706';
                            }
                            return (
                              <div style={{ fontSize: 11, color, whiteSpace: 'nowrap' }}>
                                {label}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="pl-16 pr-4 py-3 text-right align-middle">
                          <div className="flex justify-end">
                            <ReturnVendorUomInput
                              value={it.qty}
                              unit={it.uom}
                              disabled={fixed}
                              ariaLabel={`${it.sku} returned to ${viewLeg!.vendorName}`}
                              onValueChange={(v) =>
                                p.onQty(it.sku, viewLeg!.vendorCode, Math.min(v, it.cap))
                              }
                            />
                          </div>
                        </td>
                        <td className="px-2 py-3 align-middle text-center">
                          {/* Trash - takes the line off this RMA. */}
                          <button
                            type="button"
                            disabled={fixed}
                            onClick={() => p.onQty(it.sku, viewLeg!.vendorCode, 0)}
                            aria-label={`Take ${it.sku} off this RMA`}
                            className="inline-flex items-center justify-center cursor-pointer border-none bg-transparent transition-colors text-slate-400 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-end">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 rounded-lg px-5 text-[13px] bg-primary text-primary-foreground cursor-pointer transition-colors hover:bg-blue-700"
                  style={{ fontWeight: 600 }}
                >
                  Done
                </button>
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
