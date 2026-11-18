/**
 * Which branch of each group takes that group's whole return.
 *
 * Merging is the one grouping decision a return has, and it exists only because
 * some vendors on it trade under one company. Splitting needs no dialogue --
 * the paperwork already says who shipped what -- so this opens on the way into
 * merging and asks the one thing merging cannot work out on its own.
 *
 * It asks about every group at once. Opening one dialog per group answered the
 * same question twice with no way to see the whole of it: a return coming back
 * through four branches of two companies looked, twice over, like a return from
 * one company with two branches. The count in the footer is the return's, not
 * one group's.
 *
 * It has to name the items, not count them. "1 item, 10 EA of their own" says
 * nothing about what ends up on the document, and what ends up on the document
 * is the whole question.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useState } from 'react';
import { Users, Building2, X } from 'lucide-react';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { trackingModeFor } from '@/app/data/mockRMAs';
import { TRACKING_CHIP, TRACKING_LABELS } from '@/app/data/itemProvenance';

export interface MergeCandidateItem {
  sku: string;
  qty: number;
  uom: string;
}

export interface MergeCandidate {
  vendorCode: string;
  vendorName: string;
  items: MergeCandidateItem[];
  units: number;
  uom: string;
}

export interface MergeGroup {
  familyCode: string;
  familyName: string;
  candidates: MergeCandidate[];
}

export function ReturnFamilyMergeModal({
  groups,
  chosen,
  onMerge,
  onClose,
}: {
  groups: MergeGroup[];
  /** The branch already carrying each group, when this is being revisited. */
  chosen: Record<string, string>;
  onMerge: (picks: Record<string, string>) => void;
  onClose: () => void;
}) {
  // Nothing is pre-picked. Defaulting to the first branch answered the only
  // question the dialog exists to ask, and left the other branch looking like
  // a fact rather than an option.
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.filter((g) => chosen[g.familyCode]).map((g) => [g.familyCode, chosen[g.familyCode]!])),
  );

  const branches = groups.reduce((n, g) => n + g.candidates.length, 0);
  // Distinct parts. One part reaching two branches of the same company is one
  // part, and counting the rows called it two -- which is exactly the case
  // this dialog exists for, so it was wrong every time it mattered.
  const items = new Set(
    groups.flatMap((g) => g.candidates.flatMap((c) => c.items.map((i) => i.sku))),
  ).size;
  const ready = groups.every((g) => picks[g.familyCode]);

  return (
    <>
      <div className="fixed inset-0 z-[210] bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          groups.length === 1
            ? `Put these items on one ${groups[0]!.familyName} RMA`
            : `Put these items on one RMA per vendor group`
        }
        className="fixed z-[211] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,660px)] max-h-[88vh] flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_48px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start gap-3 border-b border-[#EEF2F6] px-5 py-4">
          <span className="mt-px flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-blue-50 text-primary">
            <Users className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
              {groups.length === 1
                ? `Merge ${items} ${items === 1 ? 'item' : 'items'} into one RMA`
                : `Merge ${items} ${items === 1 ? 'item' : 'items'} into ${groups.length} RMAs`}
            </p>
            <p className="text-[12px] text-slate-500 leading-snug mt-0.5">
              {branches} branches, {groups.length === 1 ? 'one company' : `${groups.length} companies`}. Pick the
              branch that raises each RMA.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {groups.map((group) => {
            const all = group.candidates.flatMap((c) =>
              c.items.map((i) => ({ ...i, vendorName: c.vendorName, vendorCode: c.vendorCode })),
            );
            const uoms = new Set(all.map((i) => i.uom));
            const uom = uoms.size === 1 ? [...uoms][0]! : 'units';
            const units = all.reduce((n, i) => n + i.qty, 0);
            const pick = picks[group.familyCode] ?? '';

            return (
              <div
                key={group.familyCode}
                className="overflow-hidden rounded-lg border border-[#E2E8F0]"
              >
                {/* Whose decision this is. With one group the heading above
                    already says it; with several, each block has to name its
                    own company or the branches below run together. */}
                <div className="flex items-baseline justify-between gap-3 border-b border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2">
                  <span className="truncate text-[12px] text-foreground" style={{ fontWeight: 700 }}>
                    {group.familyName}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                    {(() => {
                      const parts = new Set(all.map((i) => i.sku)).size;
                      return `${parts} ${parts === 1 ? 'item' : 'items'}`;
                    })()} · {formatQty(units)} {uom}
                  </span>
                </div>

                {/* What this group's one RMA would carry. */}
                <div className="divide-y divide-[#EEF2F6]">
                  {all.map((item) => {
                    const mode = trackingModeFor(item.sku);
                    return (
                      <div key={`${item.vendorCode}-${item.sku}`} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                          {item.sku}
                        </span>
                        <TrackingTag mode={mode} />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">
                          from {item.vendorName}
                        </span>
                        <span className="shrink-0 text-[12px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                          {formatQty(item.qty)}{' '}
                          <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{item.uom}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="border-t border-[#EEF2F6] px-3 pt-2 pb-1 text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                  Raised against
                </p>
                <div
                  role="radiogroup"
                  aria-label={`Branch taking the ${group.familyName} return`}
                  className="flex flex-col gap-2 px-3 pb-3"
                >
                  {group.candidates.map((c) => {
                    const selected = pick === c.vendorCode;
                    return (
                      <button
                        key={c.vendorCode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPicks((prev) => ({ ...prev, [group.familyCode]: c.vendorCode }))}
                        className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                          selected ? 'border-primary bg-blue-50/60' : 'border-[#E2E8F0] bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            selected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                          <Building2 className="w-3 h-3" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {c.vendorName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-[#EEF2F6] bg-[#FAFBFC] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[12px] text-slate-500">
              {ready ? `${groups.length === 1 ? 'One RMA' : `${groups.length} RMAs`}, credited by the branch you picked.` : 'Pick a branch for each company.'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] text-foreground transition-colors hover:bg-slate-50"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => onMerge(picks)}
                className="inline-flex items-center h-9 rounded-lg bg-primary px-4 text-[13px] text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                style={{ fontWeight: 600 }}
              >
                {groups.length === 1 ? 'Merge into one RMA' : `Merge into ${groups.length} RMAs`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
