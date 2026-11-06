import { Layers } from 'lucide-react';
import { StateTransitionOverlay } from '@/app/components/shared/StateTransitionOverlay';
import { useDocMoney } from "@/app/components/currency/docCurrencyContext";

/* ════════════════════════════════════════════════════════════════════
   Freight split / recalculation animation.

   Plays after the user confirms either:
   • Switching the freight modal to per-line (split across all lines).
   • Setting a per-line freight cost for the first time from the
     configurator (which performs the same split under the hood).

   Reuses StateTransitionOverlay so the motion + chrome match the
   existing version / status overlays. Tone is `info` (primary blue)
   because this is a constructive recalculation, not destructive.
   ════════════════════════════════════════════════════════════════════ */

interface FreightSplitOverlayProps {
  show: boolean;
  direction: 'split' | 'merge';
  total: number;
  lineCount: number;
  onComplete: () => void;
}

export function FreightSplitOverlay({ show, direction, total, lineCount, onComplete }: FreightSplitOverlayProps) {
  const fmt = useDocMoney();
  const isSplit = direction === 'split';
  const fromLabel = isSplit ? `Quote-level ${fmt(total)}` : `${lineCount} per-line charge${lineCount === 1 ? '' : 's'}`;
  const toLabel = isSplit ? `${lineCount} per-line charge${lineCount === 1 ? '' : 's'}` : `Quote-level ${fmt(total)}`;
  const heading = isSplit ? 'Splitting freight across line items' : 'Collapsing per-line freight';
  const meta = isSplit
    ? `Total kept at ${fmt(total)}, recalculating totals…`
    : `Sum becomes ${fmt(total)}, recalculating totals…`;

  return (
    <StateTransitionOverlay
      isActive={show}
      fromLabel={fromLabel}
      toLabel={toLabel}
      tone="info"
      Icon={Layers}
      heading={heading}
      meta={meta}
      duration={1400}
      onComplete={onComplete}
    />
  );
}
