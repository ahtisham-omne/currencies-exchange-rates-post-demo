/* ═══════════════════════════════════════════
   License billing rates
   ───────────────────────────────────────────
   Seat pricing and the derived company total, in one place. Every surface that
   quotes money (the license review panel, the archive confirmation, the license
   modals) reads these, so a rate change lands everywhere at once rather than in
   whichever copy someone remembered to edit.

   Placeholder pricing: ERP-5685 owns the real source. Keep the shape, expect
   the numbers to move.
   ═══════════════════════════════════════════ */
import { users as allUsers } from "../data/users-data";

export const FULL_ACCESS_DAILY = 5.0;
export const FIELD_USER_DAILY = 0.5;

/** Days in a billing cycle, used to turn a daily rate into a monthly estimate. */
export const CYCLE_DAYS = 30;

/** Days left in the current cycle, for the pro-rata line in the review panel. */
export const DAYS_REMAINING = 15;

export const DAILY_RATE: Record<string, number> = {
  "Full Access": FULL_ACCESS_DAILY,
  "Field User": FIELD_USER_DAILY,
  "No License": 0,
};

export function formatCurrency(n: number): string {
  return (
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Company-wide daily spend across every user's current license. */
export function companyDailySpend(): number {
  return allUsers.reduce((s, u) => s + (DAILY_RATE[u.license] ?? 0), 0);
}
