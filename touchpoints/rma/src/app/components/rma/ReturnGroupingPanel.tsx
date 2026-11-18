/**
 * How many returns this becomes, and the one case where that is a question.
 *
 * A return settles against one vendor's paperwork, so the count normally just
 * follows from who is taking goods back: two vendors are two returns, and
 * nothing is asked. A vendor's branch is a vendor in its own right, with its
 * own code, terms, address and ledger, so this holds even for two branches of
 * one company.
 *
 * The exception is that a group can absorb a sibling's return if the returner
 * asks it to. When two vendors on the return belong to one family -- the
 * serialized parts came back through one branch and the counted stock through
 * another -- there is a real choice: send each branch its own, or send the lot
 * to one of them and let the group settle it internally. That is asked once for
 * the whole return, not per part and not per vendor.
 *
 * Splitting needs nothing further, because the paperwork already says who
 * shipped what. Merging needs to know which branch takes it, so it opens the
 * choice.
 */

import { Building2, Check, Users } from 'lucide-react';
import { formatQty } from '@/app/components/vendorSelectionModel';

/** One item on a vendor's leg of the return. */
export interface LegItem {
  sku: string;
  qty: number;
  uom: string;
}

export interface GroupingLeg {
  vendorCode: string;
  vendorName: string;
  partCount: number;
  units: number;
  uom: string;
  /** What is going back to them, named. A count alone cannot answer "which
   *  items end up on one RMA", which is the question merging raises. */
  items: LegItem[];
  /** The group this vendor trades under, when it trades under one. */
  familyCode?: string | undefined;
  familyName?: string | undefined;
}

export type SplitMode = 'split' | 'merge';

/** Families with more than one vendor on this return. Only these can merge. */
export function mergeableFamilies(legs: GroupingLeg[]) {
  const byFamily = new Map<string, { familyCode: string; familyName: string; legs: GroupingLeg[] }>();
  legs.forEach((leg) => {
    if (!leg.familyCode) return;
    const entry = byFamily.get(leg.familyCode) ?? {
      familyCode: leg.familyCode,
      familyName: leg.familyName ?? leg.familyCode,
      legs: [],
    };
    entry.legs.push(leg);
    byFamily.set(leg.familyCode, entry);
  });
  return [...byFamily.values()].filter((f) => f.legs.length > 1);
}

/** The returns this becomes, each with everything it carries.
 *
 *  Splitting is one per vendor. Merging folds a family's legs into the branch
 *  that took them, so the document that stops existing stops being listed --
 *  the items it held are named under the branch that now has them, which is
 *  where someone looking for them would go. */
export function documentsFor(legs: GroupingLeg[], mode: SplitMode, mergeInto: Record<string, string>) {
  const takenBy = (leg: GroupingLeg) =>
    mode === 'merge' && leg.familyCode ? mergeInto[leg.familyCode] : undefined;

  const out: {
    vendorCode: string;
    vendorName: string;
    items: LegItem[];
    absorbed: (LegItem & { vendorName: string })[];
    units: number;
    uom: string;
  }[] = [];

  legs.forEach((leg) => {
    const holder = takenBy(leg);
    // Its own return, either because nothing is merging or because this is the
    // branch that took the group's.
    if (!holder || holder === leg.vendorCode) {
      out.push({
        vendorCode: leg.vendorCode,
        vendorName: leg.vendorName,
        items: [...leg.items],
        absorbed: [],
        units: 0,
        uom: leg.uom,
      });
    }
  });

  legs.forEach((leg) => {
    const holder = takenBy(leg);
    if (!holder || holder === leg.vendorCode) return;
    const doc = out.find((d) => d.vendorCode === holder);
    if (!doc) return;
    doc.items.push(...leg.items);
    doc.absorbed.push(...leg.items.map((i) => ({ ...i, vendorName: leg.vendorName })));
  });

  return out.map((doc) => {
    const uoms = new Set(doc.items.map((i) => i.uom));
    return {
      ...doc,
      units: doc.items.reduce((n, i) => n + i.qty, 0),
      uom: uoms.size === 1 ? [...uoms][0]! : 'units',
    };
  });
}

/** What the return becomes once the answer is applied. */
export function rmaCountFor(legs: GroupingLeg[], mode: SplitMode) {
  if (mode === 'split') return legs.length;
  const families = mergeableFamilies(legs);
  const absorbed = families.reduce((n, f) => n + f.legs.length - 1, 0);
  return legs.length - absorbed;
}

export function ReturnGroupingPanel({
  legs,
  mode,
  mergeInto,
  onSplit,
  onMerge,
}: {
  legs: GroupingLeg[];
  mode: SplitMode;
  /** Which vendor of each family takes the group's whole return. */
  mergeInto: Record<string, string>;
  onSplit: () => void;
  /** Merging has to name a branch, so choosing it opens that question. */
  onMerge: () => void;
}) {
  if (legs.length === 0) return null;

  const families = mergeableFamilies(legs);
  const total = rmaCountFor(legs, mode);
  const documents = documentsFor(legs, mode, mergeInto);
  // Merging is only actually in force once a branch has been named for a
  // group, which is what turns the question above into a statement.
  const merging = mode === 'merge' && families.some((f) => mergeInto[f.familyCode]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-[#EEF2F6] px-5 py-3">
        <span className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>RMA breakdown</span>
        <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">
          <span className="text-foreground" style={{ fontWeight: 700 }}>{total}</span>{' '}
          {total === 1 ? 'RMA' : 'RMAs'}
        </span>
      </div>

      {families.length === 0 ? (
        // Nothing to decide: every vendor here is unrelated to the others.
        <div className="border-b border-[#EEF2F6] px-5 py-2.5">
          <p className="text-[12px] leading-[1.5] text-slate-600">
            {legs.length === 1
              ? 'One return, raised against this vendor.'
              : "One return per vendor. Each is raised against that vendor's own order and credited back by them."}
          </p>
        </div>
      ) : null}

      {families.length === 0 && <Documents documents={documents} />}

      {families.length > 0 && (
        <div className="border-b border-[#EEF2F6] px-5 py-3">
          {/* Said from the items' side. Which companies are related to which is
              background; what the returner is being asked is whether these
              particular items go back on one document.
              
              Once they have answered it stops being a question. Leaving it
              phrased as one made the panel read as though nothing had been
              decided, with the answer visible only in the radio. */}
          {merging ? (
            <p className="flex items-start gap-1.5 text-[11px] leading-[1.45] text-slate-500 mb-2">
              <Check className="w-3 h-3 mt-0.5 shrink-0 text-primary" strokeWidth={3} />
              <span>
                {families.length === 1 ? (
                  <>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>
                      {families[0]!.legs.reduce((n, l) => n + l.items.length, 0)} items
                    </span>{' '}
                    from {families[0]!.legs.length} {families[0]!.familyName} branches are going back on
                    one RMA
                    {(() => {
                      const holder = families[0]!.legs.find(
                        (l) => l.vendorCode === mergeInto[families[0]!.familyCode],
                      );
                      return holder ? (
                        <>
                          , raised against{' '}
                          <span className="text-foreground" style={{ fontWeight: 600 }}>
                            {holder.vendorName}
                          </span>
                        </>
                      ) : null;
                    })()}
                    .
                  </>
                ) : (
                  <>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{families.length} groups</span>{' '}
                    are each going back on one RMA, raised against the branch you picked for them.
                  </>
                )}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[11px] leading-[1.45] text-slate-500 mb-2">
              <Users className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                {families.length === 1 ? (
                  <>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>
                      {/* Distinct parts, not rows. One part split across two
                          branches is one part reaching them both, and summing
                          the rows reported it as two. */}
                      {(() => {
                        const parts = new Set(
                          families[0]!.legs.flatMap((l) => l.items.map((i) => i.sku)),
                        ).size;
                        return `${parts} ${parts === 1 ? 'item' : 'items'}`;
                      })()}
                    </span>{' '}
                    went back to {families[0]!.familyName} through {families[0]!.legs.length} of their
                    branches. Merge them onto one RMA?
                  </>
                ) : (
                  <>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{families.length} groups</span>{' '}
                    took items back through more than one of their branches. Merge each onto one RMA?
                  </>
                )}
              </span>
            </p>
          )}
          {/* The returns sit inside the option that produces them. As a list
              under the pair they read as a third thing on the panel, and which
              of the two answers they belonged to was left to be inferred from
              the count. */}
          <div role="radiogroup" aria-label="How this return saves">
            <Choice
              label="Split by vendor"
              detail="Each branch takes back what it shipped."
              count={`${rmaCountFor(legs, 'split')} RMAs`}
              selected={mode === 'split'}
              onSelect={onSplit}
            >
              <Documents documents={documents} nested />
            </Choice>
            <Choice
              label="Merge into one RMA"
              detail="The group settles the rest internally."
              count={`${rmaCountFor(legs, 'merge')} ${rmaCountFor(legs, 'merge') === 1 ? 'RMA' : 'RMAs'}`}
              selected={mode === 'merge'}
              onSelect={onMerge}
            >
              <Documents documents={documents} nested />
            </Choice>
          </div>
        </div>
      )}

    </div>
  );
}

/** The returns a given answer produces, listed. */
function Documents({
  documents,
  nested,
}: {
  documents: ReturnType<typeof documentsFor>;
  /** Inside a selected choice, where it is that choice's own output rather
   *  than a list of its own. */
  nested?: boolean;
}) {
  return (
    <div className={nested ? 'divide-y divide-primary/10' : 'divide-y divide-[#EEF2F6]'}>
      {documents.map((doc) => (
        <div
          key={doc.vendorCode}
          className={`flex items-center gap-2.5 ${nested ? 'px-3 py-2' : 'px-5 py-3'}`}
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-md border ${
              nested
                ? 'w-6 h-6 border-primary/15 bg-white text-slate-400'
                : 'w-7 h-7 border-[#EEF2F6] bg-slate-50 text-slate-400'
            }`}
          >
            <Building2 className={nested ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate ${nested ? 'text-[12px]' : 'text-[12px]'} text-foreground`}
              style={{ fontWeight: 600 }}
            >
              {doc.vendorName}
            </p>
            <p className={`${nested ? 'text-[10px]' : 'text-[10px]'} text-slate-500 tabular-nums`}>
              {doc.items.length} {doc.items.length === 1 ? 'item' : 'items'} ·{' '}
              {formatQty(doc.units)} {doc.uom}
            </p>
            {doc.absorbed.length > 0 && (
              <p className="text-[10px] text-primary leading-[1.45] mt-0.5">
                Includes {doc.absorbed.map((a) => a.sku).join(', ')} from{' '}
                {[...new Set(doc.absorbed.map((a) => a.vendorName))].join(', ')}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] tabular-nums whitespace-nowrap ${
              nested ? 'bg-white text-slate-500 border border-primary/15' : 'bg-slate-100 text-slate-500'
            }`}
            style={{ fontWeight: 600 }}
          >
            1 RMA
          </span>
        </div>
      ))}
    </div>
  );
}

/** One of the two ways out, said the way the shipment step says it. */
function Choice({
  label,
  detail,
  count,
  selected,
  onSelect,
  children,
}: {
  label: string;
  detail: string;
  count: string;
  selected: boolean;
  onSelect: () => void;
  /** What choosing this produces. Shown only while it is the answer, indented
   *  inside its own frame, so the returns are plainly this option's. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border transition-colors mb-1.5 last:mb-0 ${
        selected ? 'border-primary bg-blue-50/60' : 'border-[#E2E8F0] bg-white'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
          selected ? '' : 'hover:bg-slate-50'
        }`}
      >
        <span
          className={`flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
          }`}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {label}
          </span>
          <span className="block truncate text-[11px] text-slate-500">{detail}</span>
        </span>
        <span className="shrink-0 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{count}</span>
      </button>
      {selected && children && (
        <div className="border-t border-primary/15 bg-white/70 pl-[30px]">
          <p className="px-3 pt-2 pb-1 text-[10px] text-primary/80 uppercase tracking-wide" style={{ fontWeight: 600 }}>
            This creates
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
