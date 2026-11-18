/**
 * A part's control type, drawn the way the master draws it.
 *
 * Four types, not three, and a lot-controlled part wears two facts rather than
 * one phrase: it is in a batch, and its units are numbered or they are not.
 * The source (`cycle-count/planHelpers.tsx`, `LotTrackingTag`) joins a grey
 * `LOT` segment to the serialization, so `LOT Serialized` and `LOT
 * Non-Serialized` read as siblings of `Serialized` and `Non-Serialized`
 * instead of as a single "Lot tracked" that hides which kind it is.
 *
 * One component because a dozen screens draw this chip, and a control type has
 * to look the same on all of them.
 */

import { TRACKING_CHIP, TRACKING_LABELS, TRACKING_NAMES } from '@/app/data/itemProvenance';
import { isLotMode, type TrackingMode } from '@/app/data/mockRMAs';

export function TrackingTag({
  mode,
  size = 'sm',
}: {
  mode: TrackingMode;
  /** `sm` is the rail and the result rows; `md` is a card header. */
  size?: 'sm' | 'md';
}) {
  const h = size === 'md' ? 'h-5' : 'h-[17px]';
  const pad = size === 'md' ? 'px-1.5' : 'px-1';

  if (!isLotMode(mode)) {
    return (
      <span
        className={`shrink-0 inline-flex items-center ${h} ${pad} rounded border text-[10px] whitespace-nowrap ${TRACKING_CHIP[mode]}`}
        style={{ fontWeight: 600 }}
      >
        {TRACKING_LABELS[mode]}
      </span>
    );
  }

  return (
    <span
      aria-label={TRACKING_NAMES[mode]}
      title={TRACKING_NAMES[mode]}
      className={`shrink-0 inline-flex ${h} items-center overflow-hidden rounded border border-violet-200 bg-white text-[10px] whitespace-nowrap`}
      style={{ fontWeight: 600 }}
    >
      <span className={`flex h-full items-center bg-violet-50 ${pad} text-violet-700`}>LOT</span>
      <span className={`${pad} text-slate-600`}>{TRACKING_LABELS[mode]}</span>
    </span>
  );
}
