import type { Payment } from '@/app/data/mockPayments';

/* ── Check number rules, shared by the run's check lots and (eventually)
 * the single-payment flow. Check numbers are unique PER pay-from account
 * (check spec 7/19/26): a number already issued from an account hard-
 * blocks; out-of-sequence in either direction warns but never blocks
 * (split checkbooks are legitimate); a jump past 100 gets the stronger
 * warning. */

const CHECK_RE = /^(?:CHK-?)?(\d+)$/i;

export function parseCheckNumber(reference: string | undefined): number | null {
  const m = CHECK_RE.exec((reference ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** Highest check number already issued from the account, across all
 *  recorded payments. Drives the proposed next number (last + 1). */
export function lastCheckNumber(payments: Payment[], accountId: string): number | null {
  const nums = payments
    .filter((p) => p.bankAccount === accountId)
    .map((p) => parseCheckNumber(p.reference))
    .filter((n): n is number => n !== null);
  return nums.length ? Math.max(...nums) : null;
}

/** The payment that already used this number on this account, so the
 *  block message can link straight to it. */
export function checkNumberInUse(payments: Payment[], accountId: string, n: number): Payment | null {
  return (
    payments.find(
      (p) => p.bankAccount === accountId && parseCheckNumber(p.reference) === n,
    ) ?? null
  );
}

export const BIG_JUMP = 100;

export interface SequenceWarning {
  level: 'warning' | 'strong';
  message: string;
}

/** Out-of-sequence warning in both directions; escalates past BIG_JUMP. */
export function sequenceWarning(n: number, last: number | null): SequenceWarning | null {
  if (last == null) return null;
  if (n <= last) {
    return {
      level: 'warning',
      message: `Out of sequence: this is lower than the last recorded check (${last}) on this account.`,
    };
  }
  if (n > last + 1) {
    const skipped = n - last - 1;
    if (n > last + BIG_JUMP) {
      return {
        level: 'strong',
        message: `Big jump ahead: this skips ${skipped} numbers past the last recorded check (${last}).`,
      };
    }
    return {
      level: 'warning',
      message: `Out of sequence: this skips ${skipped} number${skipped === 1 ? '' : 's'} ahead of the last recorded check (${last}).`,
    };
  }
  return null;
}
