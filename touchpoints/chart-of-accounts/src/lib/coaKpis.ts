import type { Account, AccountRole } from '../types'

/* ─────────────── What a role-based balance card actually counts ───────────────
   A role is how the system knows what an account is for, so the balance cards
   read the role and nothing else - the name match this replaced quietly swept in
   anything called "cash" or "payable".

   But a role only ever lands on the account that holds the thing, never on the
   valuation account filed beside it. Nobody gives the allowance for doubtful
   accounts the receivables role, because it is not receivables; it is what the
   receivables are not worth. Counting the role-bearing accounts alone therefore
   reported gross, and the card said $421,000 of receivables directly above a
   summary row reading $402,500 - the $18,500 allowance, with nothing on either
   surface to account for the gap. Two figures for one thing, on one screen.

   So the contras filed under the same summary are counted too, and the card
   lands where the row does. Sharing a summary is what makes a contra the
   valuation of these accounts rather than of some other branch, which is why
   parentage decides it and not the account type: accumulated depreciation is a
   contra as well, and has nothing to do with receivables. */
export function roleKpiAccounts(posting: Account[], roles: AccountRole[]): Account[] {
  const named = posting.filter(a => !!a.accountRole && roles.includes(a.accountRole))
  // No account plays the part, so there is no branch to net anything against. A
  // stray contra must not become the whole figure.
  if (!named.length) return []
  const taken = new Set(named.map(a => a.id))
  const branches = new Set(named.map(a => a.parentId).filter((p): p is string => !!p))
  return [
    ...named,
    ...posting.filter(a => a.isContra && !taken.has(a.id) && !!a.parentId && branches.has(a.parentId)),
  ]
}

/** The figure a role-based card states: the accounts holding the thing, less
 *  whatever is set against them. */
export function roleKpiBalance(posting: Account[], ...roles: AccountRole[]): number {
  return roleKpiAccounts(posting, roles).reduce((s, a) => s + (a.balance || 0), 0)
}
