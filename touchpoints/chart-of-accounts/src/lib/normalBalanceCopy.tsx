// Canonical explanation of the Normal balance field, read by every (i) tooltip
// that offers it - the listing column header and the creation form.
export const NORMAL_BALANCE_HELP = 'The side where the account balance normally increases. Assets and expenses normally have a debit balance, while liabilities, equity, and revenue normally have a credit balance.'

/* Kept apart from the definition because it answers a question only a reader who
   can change the field is asking. The listing column is read, not set, so it
   takes the definition alone; the creation form and the detail page take both. */
export const NORMAL_BALANCE_CHOOSING = 'Omne sets this from the account category. You only need to change it for a contra account, such as Accumulated Depreciation, which uses a credit balance to reduce the value of the related asset.'

/* What a contra account is, said on the account itself. A contra account is the
   one place the normal balance does not follow from the category, so a page that
   prints the category and leaves this out has told the reader the wrong thing by
   omission - and it is the same page whose figures then read the other way round
   from what they expect. */
export const CONTRA_ACCOUNT_LINE = 'Contra account: it carries the opposite side to its category, so it reduces the accounts it sits with rather than adding to them.'

/* How to read a signed figure on an account, stated where the figures are.
   Every balance in the app is normal-side signed (see lib/monthlyLedger): a
   positive figure means more of the account's own natural balance. On a
   credit-normal account that is the reverse of debit less credit, which is why
   the convention has to be printed and not assumed. */
export const signConventionLine = (normalBalance: string) =>
  `Positive figures on this page move toward ${normalBalance.toLowerCase()}, this account's normal side.`

/* Carries its own card chrome, matching GLTypeLegend: a rich Tooltip supplies
   only the white card and shadow, so callers must pass `rich`.

   The two optional facts are the account's own, and only a page looking at one
   account can supply them. Given them, the card also says what that account's
   contra flag means and which way to read its signed figures - copy that used to
   sit on the detail page as two more lines of prose under the value. It reads the
   same here and costs the page nothing until asked for. */
export function NormalBalanceHelp({ normalBalance, isContra }: { normalBalance?: string; isContra?: boolean }) {
  return (
    <div className="w-[300px] p-3.5">
      <p className="text-11 text-fg-muted leading-relaxed">{NORMAL_BALANCE_HELP}</p>
      <p className="mt-2 text-11 text-fg-muted leading-relaxed">{NORMAL_BALANCE_CHOOSING}</p>
      {isContra && <p className="mt-2 text-11 text-fg-muted leading-relaxed">{CONTRA_ACCOUNT_LINE}</p>}
      {normalBalance && <p className="mt-2 text-11 text-fg-muted leading-relaxed">{signConventionLine(normalBalance)}</p>}
    </div>
  )
}
