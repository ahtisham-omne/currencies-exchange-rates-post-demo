/**
 * How far a newly agreed restocking fee should reach.
 *
 * A vendor's restocking fee is usually found out rather than looked up: the
 * buyer hears "we keep fifteen percent" on the call that authorizes the first
 * return, and unless somebody writes it down the next return finds it out
 * again. So a fee that is not the one on the vendor's profile pauses the save
 * on the one question that turns a fact into a default.
 *
 * It only appears when there is a real choice to make: a fee that matches what
 * the vendor already has on file has been agreed before, and re-asking every
 * time would be a dialog that trains people to dismiss it.
 *
 * The dialog itself is the purchase order's, not one of ours. It asks the
 * buyer the same thing when an item is ordered from a vendor it is not
 * qualified against -- use it here, or put it on the partner -- and it is the
 * same decision, so it is the same dialog: `ScopeWarningDialog`, ported from
 * `PriceWarningShell`. All this file does is hand it the copy.
 *
 * Three surfaces open it, the approval, the detail page's vendor charges and
 * the last step of the create flow, and all three read the standard off the
 * RMA context, so an answer given on one stops the other two asking.
 */

import { formatMoney as moneyIn } from '@/app/currency/money';
import { ScopeWarningDialog } from '@/app/components/rma/ScopeWarningDialog';

export function RestockingFeeScopeModal({
  open,
  onOpenChange,
  vendorName,
  /** The fee just entered, as a percentage. */
  pct,
  /** What that percentage comes to on this return. */
  amount,
  /** What the vendor already has on file, when they have anything. Left out
   *  on the first fee anybody has ever recorded against them. */
  currentPct,
  currency = 'USD',
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  pct: number;
  amount: number;
  currentPct?: number | undefined;
  currency?: string;
  onChoose: (scope: 'return' | 'vendor') => void;
}) {
  const money = (n: number) => moneyIn(n, currency);
  const bold = { fontWeight: 600 };

  return (
    <ScopeWarningDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="blue"
      chipLabel="Restocking fee"
      title="Would you like to set this restocking fee at partner level?"
      description={
        <>
          You&apos;re charging <span style={bold}>{vendorName}</span> a{' '}
          <span style={bold}>{pct}%</span> restocking fee,{' '}
          <span style={bold}>{money(amount)}</span> on this return
          {currentPct != null && (
            <>
              , where they are on file for <span style={bold}>{currentPct}%</span>
            </>
          )}
          . Apply it to this RMA only, or at partner level, which covers this RMA and
          every return after it.
        </>
      }
      primaryLabel="Apply to this RMA only"
      secondaryLabel="Apply at partner level and this RMA"
      onPrimary={() => onChoose('return')}
      onSecondary={() => onChoose('vendor')}
    />
  );
}
