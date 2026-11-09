# Copy Patterns Library for Omne ERP

Templates and examples for the common UX copy patterns in Omne. Reference this when generating copy for a specific element type.

## Button Labels

**Format:** Verb + noun, sentence case, no ending punctuation.

- Good: "Add bank account", "Save draft", "Approve selected", "Reject count", "View details"
- Bad: "Add A Bank Account", "Adding bank account", "Cherry pick counts to approve"

Rules:

- Start with an action verb
- Keep to 2-3 words where possible
- Match the button's outcome, not the flow it opens
- Do not use "Submit" as a generic verb. Use the specific action ("Approve", "Send for review", "Post to GL")

## Section Headers

**Format:** Noun phrase, sentence case, no ending punctuation. Should describe what is in the section, not what the user should do.

- Good: "Rule details", "Line items", "Payment schedule", "Reconciliation summary"
- Bad: "Basics", "Add line items", "Setup payment schedule", "Enter your info here"

Parallel structure matters. If one section is "Rule details", the sibling section should be "Rule logic", not "Set up the rule".

## Field Labels

**Format:** Noun or noun phrase, sentence case, no ending punctuation, no colon.

- Good: "Need-by date", "Ship to", "GL account", "Total amount"
- Bad: "Need-by date:", "Need by", "General Ledger Account Number", "Enter amount here"

Rules:

- Never end with a colon
- Never include instructional text ("Enter your..." belongs in placeholder or helper text)
- Use industry-standard terms (accountants say "GL account", not "Ledger reference")
- Match the term the user speaks aloud when they refer to the field

## Placeholders

**Format:** Short phrase, sentence case, describes the expected input format.

Rules:

- Placeholder is not a replacement for a label. Both are needed.
- Use format hints, not instructions ("mm/dd/yyyy" is a hint, "Enter your birthdate" is an instruction that belongs in helper text)
- Don't repeat the label ("Bank account name" label with "Enter bank account name" placeholder is redundant)

Good placeholders:

| Field | Placeholder |
|---|---|
| Amount | "0.00" |
| Date | "Select date" or "mm/dd/yyyy" |
| Search | "Search by name, ID, or reference" |
| Reason | "Enter a reason..." (ellipsis signals free text) |

## Helper Text

**Format:** One sentence, sentence case, ending with a period. Sits directly below the field.

Rules:

- Add context the label can't
- Explain constraints, defaults, or downstream effects
- Never repeat what the label already says
- Keep to one sentence. If it needs more, move it to a tooltip.

Good examples:

- "The vendor's commitment to ship by this date."
- "Calculated from the promised ship date plus transit time for the selected ship method."
- "Uses the primary warehouse by default."
- "Up to 100MB per file, 10MB per image."

## Tooltip Bodies

**Format:** One to two sentences. First sentence describes the concept. Second sentence adds nuance, caveat, or downstream behavior.

Rules:

- Longer than helper text is fine, but keep it scannable
- If it needs more than two sentences, consider whether it belongs in a doc link or an inline explainer instead
- End with a period

Good examples:

- "The vendor's commitment to ship by this date. If this slips, it will be logged but won't change the PO unless you accept the new date."
- "Auto-calculated as the latest expected delivery across all lines. When this date hits, the entire PO should be in your hands."
- "The difference between your bank balance and your book balance. This usually clears once all transactions are reviewed and reconciled, but a persistent gap can indicate missing entries."

## Empty States

**Format:** Short phrase, sentence case, no ending punctuation. Match the field's ownership.

| Field type | Pattern | Example |
|---|---|---|
| Editable (user-owned) | "Select [thing]" or "Enter [thing]" | "Select date", "Enter amount" |
| Vendor-owned or externally-populated | "Awaiting [source]" | "Awaiting vendor response" |
| Derived / calculated | "Pending [upstream input]" | "Pending promised ship date" |
| Read-only reference | "Not available" or "Not set" | "Not available" |

For entire empty screens (no records yet):

- Explain what the screen will show
- Give a clear first action
- Do not apologize or use overly cheerful language

Good:

> **No purchase orders yet.**
> Create your first PO to start tracking vendor commitments.
> [Create PO]

Bad:

> **Uh oh, it's empty here!**
> Looks like you haven't created any purchase orders yet. Not to worry — you can get started by clicking the button below!
> [Create Your First Purchase Order]

## Confirmation Dialogs

**Format:**

- **Heading:** short question in sentence case, describes what is about to happen
- **Body:** one to two sentences, describes the consequence
- **Primary button:** verb phrase describing the action being confirmed
- **Secondary button:** verb phrase describing the alternative

Template:

> **[Action] [thing]?**
> [What will happen when they confirm].
> [Alternative action] [Primary action]

Good examples:

> **Save as draft?**
> Your count will be saved so you can pick up where you left off.
> [Keep counting] [Save draft]

> **Reject the count in this location?**
> The counts you select will either be sent back for a recount or discarded to keep system count.
> [Cancel] [Reject]

Bad patterns to avoid:

- "Are you sure you want to..." headings
- "Yes" / "No" buttons (always use verb phrases)
- "Cancel" / "OK" buttons (always use specific actions)
- Body copy that just repeats the heading

## Error Messages

**Format:**

- Say what happened in plain language
- Say what the user can do about it
- Do not blame the user
- Do not use technical jargon

Good examples:

- "This bank account already exists. Try a different account number."
- "The PO can't be posted because 3 line items are missing GL accounts. Review the highlighted lines to continue."
- "Payment failed. Check your bank connection or try a different account."

Bad examples:

- "Duplicate entry violation on unique constraint bank_account_number."
- "Error 500: Something went wrong."
- "Invalid input. Please try again." (What's invalid? Try again with what?)

## Notes and Callouts

**Format:** One to two sentences. No "Note:" prefix. Start with the substantive point.

Rules:

- The visual container (icon + colored background) already signals "this is a note". Don't repeat that in words.
- Lead with what the user needs to know, not with framing
- Keep to two sentences max

Good:

> This serial unit doesn't exist in the system. It will be created when approved.

> This only updates the submitted count. On-hand inventory will update after review and approval.

Bad:

> Note: This serial unit isn't recognized in the system. It will be created upon approval.

> Please note that this action will only update the submitted count for this cycle count and will not change on-hand inventory until the results are reviewed and approved.

## Success Messages

**Format:** Past tense, subject + verb + object. Short.

Good:

- "Count submitted."
- "Payment recorded."
- "PO sent to vendor."
- "3 items approved."

Bad:

- "Success! Your count has been successfully submitted for review."
- "Great job! You've just approved 3 items."

Rules:

- Never use "Success!" or "Great!" as a prefix. The green checkmark handles that.
- Include the count when relevant ("3 items" beats "Items")
- No exclamation marks
- No congratulations

## Loading States

**Format:** Present continuous, ending with three dots.

- Good: "Loading purchase orders...", "Calculating totals...", "Sending to vendor..."
- Bad: "Please wait...", "Loading...", "One moment..."

Rules:

- Say what is loading, not that something is loading
- Three dots at the end signals ongoing action
- Keep to 2-4 words

## Table Column Headers

**Format:** Noun phrase, sentence case, no ending punctuation. Match the full field label but shorter if space is tight.

Rules:

- If the field label is "Need-by date", the column header is "Need-by date"
- Don't abbreviate unless you have to. If you do, be consistent across the app.
- Sortable columns should be nouns, not instructions ("Amount" not "Sort by amount")
- Right-align numeric columns, left-align text columns (convention across all major ERPs)
