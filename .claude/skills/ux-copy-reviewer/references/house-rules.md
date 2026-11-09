# Omne House Rules for UX Copy

Baked-in defaults for Omne ERP copy. Only deviate when the user explicitly overrides.

## Case

**Sentence case for everything by default.** Buttons, labels, headings, section titles, tooltip bodies, all sentence case.

Title Case only if:

- The user has established Title Case as a convention for a specific hierarchy level (rare in Omne)
- The copy is a proper noun (an actual module name like "Vendor Payments" if that is registered as the module's name)

**Always flag Title Case appearing alongside sentence case in the same screen.** Consistency matters more than the specific choice. If a screen is mixed, pick a lane and normalize.

Common cases in Omne where mixed case shows up as a bug:

- Section headers in Title Case, field labels in sentence case
- Button labels in Title Case, everything else in sentence case
- Modal titles in sentence case, modal body headings in Title Case

## Punctuation and Typography

- **No em-dashes anywhere.** Use periods, commas, colons, or restructured sentences.
- Use ASCII punctuation. No smart quotes unless the surrounding text uses them.
- Oxford commas on.
- American English by default. Only switch on user request.
- No trailing colons on labels ("Need-by date" not "Need-by date:").
- No ending punctuation on button labels or headings.
- Periods on full sentences in helper text and tooltip bodies.

## Confirmation Dialogs

Prefer the **consequence-statement pattern** over the **"are you sure" pattern**:

**Good:**

> **Save as draft?**
> Your submitted count will be saved so you can pick up where you left off.
> [Continue count] [Save draft]

**Bad:**

> **Save submitted count to resume later**
> The submitted count be saved as draft. Are you sure you want to save draft to continue later?
> [Continue count] [Save Draft]

The consequence-statement pattern:

1. Short question as heading (what is happening)
2. Short body describing what will happen next
3. Clear action buttons that answer the heading question directly

## Notes and Callouts

**Never prefix note copy with "Note:"** when the visual container already signals it is a note. The icon and callout box do the labeling job. Start with the substantive point.

**Good:** "This serial unit doesn't exist in the system. It will be created when approved."

**Bad:** "Note: This serial unit isn't recognized in the system. It will be created upon approval."

Notes should be short. If a note is longer than two sentences, either break it up, move it to a tooltip, or reconsider whether it belongs in a note at all.

## Warning Icons

Reserve warning icons (⚠️) for real risk:

- Data loss
- Irreversible actions (delete, publish, submit for approval)
- Dependency breakage (removing something that other things depend on)
- Financial impact (posting to GL, sending payment)

Do not use warning icons for:

- Save actions
- Draft actions
- Exit or cancel actions
- Routine confirmations

Warning fatigue is real. When every dialog has a warning icon, users stop reading them, and the real warnings get ignored.

## Empty States

Empty states differ by field ownership:

| Field type | Empty state pattern | Example |
|---|---|---|
| Editable (buyer-owned) | "Select [thing]" or "Enter [thing]" | "Select date", "Enter amount" |
| Vendor-owned or externally-populated | "Awaiting [source]" or "Not yet provided" | "Awaiting vendor response" |
| Derived or calculated | "Pending [upstream input]" | "Pending promised ship date" |
| Read-only reference | "Not available" or "Not set" | "Not available" |

## Ambiguous Polarity

Numbers with signs (positive/negative) need a supporting line that removes ambiguity.

**Good:**

> -$10,904.12
> Bank is behind your books

**Bad:**

> -$10,904.12
> (no supporting text)

Never rely on the sign alone to communicate direction. Users will misread it half the time, especially in accounting contexts where the same variance can be expressed two ways depending on convention.

Also: pick one polarity convention across the app and document it. If "Bank - Books" is the standard for reconciliation gaps, use it everywhere. Do not flip conventions between modules.

## Descriptive Text

**Invoke the humanizer skill** for anything longer than one sentence.

Descriptive text (helper text, tooltip bodies, empty state copy, note bodies, error messages) is where AI patterns tend to leak in. The humanizer skill catches:

- Rule of three ("clear, concise, and effective")
- Inflated symbolism ("empowering", "seamless")
- Over-balanced hedging ("This might potentially help you...")
- Predictable AI vocabulary
- Low sentence burstiness (everything the same length)

Run any multi-sentence copy through humanizer before finalizing.

## Do Not Fabricate

If the underlying flow logic is unclear, **ask**. Do not invent behavior.

Common places this comes up:

- Is the "100MB" a per-file or total limit? Ask.
- Is the "expected delivery" date derived or manually entered? Ask.
- Is "promised date" a ship promise or a delivery promise? Ask.
- Does the negative reconciliation number mean bank is behind books or books are behind bank? Ask.

A single clarifying question is always cheaper than writing copy that turns out to describe the wrong behavior.

## Terminology Discipline

Once a term is chosen for a concept, use it everywhere. Common places this drifts in Omne:

- "LOT" vs. "Lot" vs. "batch"
- "PO" vs. "Purchase Order" vs. "Purchase order"
- "GL account" vs. "General Ledger Account" vs. "Ledger"
- "Vendor" vs. "Supplier"
- "Warehouse" vs. "Location" vs. "Site"

Flag inconsistencies when reviewing. If the user says "we use LOT everywhere", enforce it everywhere.

## Button Label Discipline

Verb + noun. Sentence case. No ending punctuation.

- Good: "Add bank account"
- Bad: "Add A Bank Account", "Adding bank account", "Add bank account."

If a button is doing more than one thing, split it or rename it. Ambiguous buttons cause misclicks in ERP where actions have real financial consequences.

## Section Header Discipline

Noun phrases that describe what is in the section. Not instructions.

- Good: "Rule details", "Line items", "Payment schedule"
- Bad: "Basics", "Add line items", "Setup payment schedule"

Instructional headers ("Enter rule info", "Configure your payment") add nothing that the section content doesn't already communicate.
