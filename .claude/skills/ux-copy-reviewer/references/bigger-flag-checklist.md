# Bigger Flag Checklist

The "one bigger flag" section of a deep review is where the copy reviewer adds the most value. It goes beyond fixing the copy to flag the underlying UX or convention concern.

Every deep review ends with one elephant-in-the-room callout. Pick the most significant issue from the categories below. If genuinely no bigger flag exists, say so honestly rather than manufacturing one.

## Category 1: Consistency

Cross-reference the current screen against the rest of the app for:

- **Case:** Title Case in one section, sentence case in another
- **Verb choice:** "Select" in one option, "Choose" in another (for the same kind of action)
- **Terminology:** "LOT" vs. "Lot" vs. "batch" in different places
- **Action button conventions:** "Save" vs. "Submit" vs. "Confirm" for the same conceptual action
- **Punctuation:** trailing periods on some labels, none on others
- **Field ordering:** address fields in one order on the Vendor screen, another order on the Customer screen

How to flag:

> Consistency check: [term/pattern] appears as [variant A] here and [variant B] elsewhere in the app. Pick one and normalize across screens.

## Category 2: Polarity and Sign Conventions

Flag when:

- A negative number could mean two different things depending on convention (Bank - Books vs. Books - Bank)
- A direction (Ship To vs. Bill To vs. Pay To) is ambiguous or missing
- A "difference" or "variance" doesn't specify what is being compared to what
- A currency conversion doesn't specify which direction
- A percentage change doesn't specify from what baseline

How to flag:

> The card shows -$X when [condition]. Worth confirming with the domain experts which polarity Omne uses ([option A] vs. [option B]). Either is defensible but pick one and document it, otherwise users will misread the sign every time.

## Category 3: Icon and Tone Mismatch

Flag when:

- Warning icons (⚠️) appear on routine actions (save, exit, cancel)
- Success icons (✓) appear on incomplete states
- Info icons (ⓘ) appear on genuinely urgent messages
- The icon color contradicts the message tone (red icon on a routine info message, yellow on a positive one)
- Destructive actions don't have destructive styling

How to flag:

> The [icon] on [action] feels overkill. [Action] isn't destructive or risky. A neutral [info/no icon] would match the action's actual weight. Reserve the amber/warning treatment for real risk, otherwise the team gets warning fatigue and starts ignoring the real ones.

## Category 4: User Mental Model

Flag when the UI surfaces internal plumbing that the user does not think in:

- GL accounts on a bank account setup flow (accountants know, ops users don't)
- System-generated IDs on user-facing fields
- Technical entity names ("record", "entity", "object") instead of business terms ("invoice", "order", "customer")
- Backend field names bleeding into labels ("customer_id" vs. "Customer")
- Feature codenames (like "Billy Bob") appearing in user-facing copy

Rule of thumb: name things the way the user talks about them at their desk, not the way engineers named them in the codebase.

How to flag:

> This screen surfaces [technical concept] to the user. If the primary user is [accountant/controller], they'll expect this. If it's [ops user/business owner], they think in [business term] not [technical term]. Worth confirming who the primary user is here.

## Category 5: Redundancy

Flag when:

- Label repeats the section header ("Bank vs books difference" inside a "Bank Reconciliation" section)
- Placeholder text repeats the label
- Helper text repeats the label without adding new info
- Two adjacent lines say the same thing in different words
- A dollar amount appears in the main KPI and again in the supporting line ("-$10,904.12" and "Bank is $10,904.12 lower")

How to flag:

> The [element] and [element] are saying the same thing twice. Either drop one, or make them additive so each earns its space.

## Category 6: Localization Risk

Flag when:

- Button copy is close to the container edge and would overflow in German or Finnish (both notoriously verbose)
- Idioms or cultural expressions won't translate ("cherry pick", "in the weeds", "on the fence")
- Word order assumptions break in RTL (Arabic, Hebrew) or SOV (Japanese, Turkish) languages
- Currency symbols are hardcoded ($) instead of locale-aware
- Date formats are hardcoded (mm/dd/yyyy) instead of locale-aware
- Number formats (comma vs. period as decimal) are assumed

How to flag:

> Omne targets [markets]. In [language], this copy would [break/lengthen/reorder]. Worth either shortening now or budgeting space for translation.

## Category 7: Missing State

Flag when:

- Empty states aren't defined
- Error states aren't defined
- Edge cases (zero amounts, negative durations, missing dependencies) aren't handled
- Loading states aren't specified
- The current copy assumes the "happy path" but doesn't handle "no data" or "partial data"

How to flag:

> The current copy handles [happy path scenario], but what happens when [edge case]? The empty/error/loading state needs its own copy. Right now it's undefined.

## When Not to Flag

Some reviews don't have a bigger flag. That's fine. Say so directly:

> No bigger flag on this one. The copy issue is the only issue.

Do not manufacture concerns to look thorough. That erodes trust in the ones that matter.

## Priority Order

If more than one category applies, pick in this priority order:

1. **User mental model** (structural, affects everyone using the screen)
2. **Polarity/sign conventions** (finance-critical, misreads have real consequences)
3. **Consistency** (visible to detail-oriented users, especially accountants)
4. **Missing state** (breaks the app for a subset of users)
5. **Icon/tone mismatch** (contributes to overall UX fatigue)
6. **Redundancy** (mostly aesthetic, but worth flagging)
7. **Localization risk** (only if Omne is actively expanding into those markets)

Only surface one flag per review. If two are equally important, mention both in the same bigger flag section but keep them tight.
