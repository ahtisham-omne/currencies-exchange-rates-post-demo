import type { RMAVersionSnapshot } from '@/app/data/rmaVersions';
import { Money } from '@/app/components/currency/Money';

/** An amount of a version in the page's view (returnView.tsx): PKR at its
 *  receiving rate on Base Currency, the return's own currency on Vendor
 *  Currency, the other one and the rate on hover.
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
    <Money
      value={value}
      currency={snap.currency}
      fx={snap.receivingFx ?? null}
      className={className}
      role="Return currency"
    />
  );
}
