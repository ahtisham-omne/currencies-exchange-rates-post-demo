import { Lock } from 'lucide-react'

/* The Account role field's own label tooltip, and now the only thing a role
   explains on hover. Mahad, 2026-09-21: *"Remove hover from account roles."*
   Each individual role used to carry a rich card of its own - what it means, an
   example, the control-account rule, its normal balance - on the picker pills,
   the role dropdown and the detail rail. A card per pill meant a reader could
   not run their eye along the options without one opening over the form.

   So this answers "what is a role for" and nothing answers "what is this role":
   the names are the reader's own vocabulary, and the two rules that actually
   constrain them are here rather than spread across a dozen cards. */
export function RoleFieldTooltip() {
  return (
    <div className="w-[320px] p-3.5">
      <p className="text-11 text-fg-muted leading-relaxed">
        A role tells the system what job this account does. It sets the normal balance, switches on features like the bank feed, and decides who can post to the account.
      </p>
      <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-primary/15 bg-accent px-3 py-2.5">
        <Lock className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
        <p className="text-11 text-primary leading-relaxed">
          Some roles are control accounts: their balance is owned by a behind-the-scenes list (customers, vendors, or items), so only the system can post to them and the balance always matches that list.
        </p>
      </div>
    </div>
  )
}
