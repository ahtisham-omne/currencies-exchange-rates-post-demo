import type { LockedPick } from '../components/NotifyRecipientsPicker'

/* ──────────────────────────────────────────────────────────────────
 * WHO CAN SEE A RESTRICTED ACCOUNT
 *
 * Design review, 2026-10-08 - Eli, on the access list beside the Restricted
 * account switch:
 *
 * - Access is set per account, but it starts from a default: *"you still need a
 *   default because I don't want to force you into having to manage it for
 *   every single one"*. The default belongs to the permissions module (who can
 *   see restricted accounts); an account's own list overrides it for that
 *   account only.
 * - *"You can't ever have a restricted account that's restricted to everyone"*,
 *   so turning the switch on fills the list from that default.
 * - The account owner can't be taken off: *"the account owner role will always
 *   show as available and blocked and grayed out"*.
 * - The switch needs a full explanation of what restricted means, with an
 *   everyday example.
 *
 * The permissions module has no screen for the default in this prototype, so it
 * is the constant below unless the company record carries one.
 * ────────────────────────────────────────────────────────────────── */

/** Who sees restricted accounts unless an account says otherwise. */
export const DEFAULT_RESTRICTED_ACCESS: string[] = ['role:Controller', 'role:Accounting Manager']

export const ACCOUNT_OWNER_ACCESS: LockedPick = {
  id: 'locked:account-owner',
  name: 'Account owner',
  note: 'The owner of your Omne account can always see every account. This can’t be removed.',
}

/** The explanation in the (i) beside the switch on Create GL account. Mahad,
    2026-10-08: in a tooltip rather than as a long description, in his words. */
export const RESTRICTED_EXPLAINER =
  'Only people you give access to can see this account, its balance, and its transactions. For example, your bookkeeper can work in the operating account without seeing the money market account that holds your reserves.'

/** Under the access list: whether it is still the default. */
export const ACCESS_IS_DEFAULT = 'Your company’s default access for restricted accounts.'
export const ACCESS_IS_CUSTOM = 'Set for this account only.'

export const sameAccess = (a: string[], b: string[]) =>
  a.length === b.length && a.every(id => b.includes(id))
