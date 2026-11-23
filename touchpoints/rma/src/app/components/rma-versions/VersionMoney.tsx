import type { RMAVersionSnapshot } from '@/app/data/rmaVersions';
import { BaseMoney } from '@/app/components/currency/Money';

/** An amount of a version in PKR at its receiving rate, the return's own
 *  currency and the rate on hover (Currency Touchpoints Map, 2026-11-24).
 *  The rate is the snapshot's, the receipt's, so a new version doesn't move
 *  the figures. */
export function VersionMoney({
  snap,
  value,
  className,
}: {
  snap: Pick<RMAVersionSnapshot, 'currency' | 'receivingFx'>;
  value: number;
  className?: string | undefined;
}) {
  return (
    <BaseMoney
      value={value}
      currency={snap.currency}
      fx={snap.receivingFx ?? null}
      className={className}
      role="Return currency"
    />
  );
}
