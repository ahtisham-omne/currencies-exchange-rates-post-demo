# Worked Examples

Real UX copy reviews from Nophil's Omne sessions. Use these to calibrate tone, structure, and depth of critique.

## Quick Mode Examples

### Example 1: Verb replacement

**User:** "Cherry pick submitted counts to approve. Can you make this less wordy and American English?"

**Response:**

Options:

- **Select counts to approve.** (instruction)
- **Approve selected counts.** (button/action label)
- **Choose which counts to approve.** (if a touch more context is needed)

"Cherry pick" reads informal for ERP UI. "Select" is the standard term across most ERP/SaaS products and works cleanly in American English.

If you tell me whether this is button text, a section header, or instructional copy, I can sharpen further.

### Example 2: Word choice

**User:** "detected or noted?"

**Response:**

"Noted" is the better fit here.

- **Detected** = found / spotted (passive observation)
- **Noted** = found AND recorded (action taken)

In a Cycle Count status update, "noted" reads stronger because it implies the discrepancies are captured for follow-up, not just observed. That's what a stakeholder wants to hear in a status line.

If you want to go even more action-oriented, "flagged" or "logged" also work, but "noted" is the cleanest for a one-liner.

### Example 3: Section rename

**User:** "Can you suggest a replacement name for 'Basics'?"

**Response:**

"Basics" is fine but a bit generic and reads slightly informal for a finance/accounting module. A few stronger options:

**Better options:**

- **Rule details** — describes what the section actually contains
- **Rule setup** — frames it as the configuration step
- **General** — common pattern in ERP forms (Salesforce, NetSuite conventions)

**My pick:** **"Rule details"**

Mirrors how the section below is named ("Rule logic"). Pairs nicely: *Rule details* + *Rule logic*. Reads as professional in a finance context without being stiff.

## Deep Mode Examples

### Example 1: Reject Count Modal

**User:** [screenshot of a Reject Count modal with two options]

**Response:**

## Issues

1. Modal title is slightly wordy: "Would you like to reject the count in this location?"
2. Grammatical error in Option 1 description: "for which... for" (preposition repeated)
3. Verb inconsistency between options: "Select" (Option 1) vs. "Choose" (Option 2)
4. Option 2 description reads confusingly: "reject count against and retain system count for"

## Suggested Versions

**Title:**

- "Reject the count in this location?"

**Option 1 description:**

- "These LOTs will be sent back for a recount."

**Option 2 label + description:**

- "Select LOTs to keep system count"
- "These LOTs will keep their existing system count and the new count will be discarded."

## My Pick

Use the reframed versions above. Consequence-statement pattern makes the descriptions informational rather than instructional, which avoids repeating the label copy. Both options now start with "Select" for verb consistency.

## One Bigger Flag

"LOTs" vs. "Lots" caps treatment is inconsistent across the app. Confirm the Omne convention. If we treat "LOT" as an acronym, apply it everywhere. If it is just a noun, use "Lots" everywhere. Right now it varies screen to screen, which reads as sloppy in a product where accountants notice details.

### Example 2: Bank Reconciliation KPI Card

**User:** [screenshot of a KPI card showing "-$10,904.12" with "Bank vs books difference" label and a tooltip]

**Response:**

## Issues

1. Card title "Bank vs books difference" reads casual for an accounting KPI. "vs" is informal and "difference" buries the actual concept (this is a reconciliation gap).
2. Card value shows "-$10,904.12" with no context on polarity. User has to read the supporting line to understand what negative means.
3. Supporting line "Bank is $10,904.12 lower than your books" repeats the dollar amount already in the KPI.
4. Tooltip includes reassurance ("usually clears") that could mask real issues. Some gaps don't clear.

## Suggested Versions

**Title:**

- **Unreconciled balance** (most accounting-accurate)
- **Reconciliation gap** (clearer about what it represents)
- **Bank vs. book variance** (closest to current, just sharpened)

**Supporting line:**

- **Bank is behind your books** (when negative)
- **Bank is ahead of your books** (when positive)

**Tooltip:**

- "The difference between your bank balance and your book balance. This usually clears once all transactions are reviewed and reconciled, but a persistent gap can indicate missing entries."

## My Pick

**"Unreconciled balance"** as title, **"Bank is behind your books"** as supporting line, sharpened tooltip. Removes the redundant dollar amount, uses accounting-industry vocabulary, and doesn't over-reassure the user that the gap will resolve itself.

## One Bigger Flag

The card is showing negative when bank is lower than books. Confirm with finance/accounting experts (or Eli) which polarity makes sense in Omne's convention. Some systems show "Bank - Books" (negative = bank lower), others show "Books - Bank" (negative = books lower). Either is defensible but pick one and document it. Otherwise users will misread the sign every time.

### Example 3: PO Date Fields

**User:** "I'm dealing with three different dates on the purchase order module. Help me write UX copies and descriptions of all four dates."

**Response after clarification on the logic:**

## Line item level

### 1. Need-by Date

- **Label:** Need-by date
- **Placeholder (empty state):** Select date
- **Helper text:** When you need this item shipped from the vendor.
- **Tooltip:** The date you want the vendor to ship this line. This is your requirement, not the vendor's commitment.

### 2. Promised Ship Date

- **Label:** Promised ship date
- **Placeholder (empty state):** Awaiting vendor response
- **Helper text:** The date the vendor has committed to ship this line.
- **Tooltip:** The vendor's commitment to ship by this date. If this slips, it will be logged but won't change the PO unless you accept the new date.

### 3. Expected Delivery (derived)

- **Label:** Expected delivery
- **Display treatment:** Read-only, visually distinct from editable fields
- **Empty state:** Pending promised ship date
- **Helper text:** Calculated from the promised ship date plus transit time for the selected ship method.
- **Tooltip:** Auto-calculated. Updates when the promised ship date or ship method changes.

## Header level

### 4. Expected PO Completion (derived)

- **Label:** Expected PO completion
- **Display treatment:** Read-only, calculated
- **Empty state:** Pending line-level dates
- **Helper text:** The date your full PO is expected to be delivered.
- **Tooltip:** Auto-calculated as the latest expected delivery across all lines. When this date hits, the entire PO should be in your hands.

## One Bigger Flag

You'll want a small visual cue distinguishing vendor-owned (Promised Ship Date) from buyer-owned (Need-by Date) on the line. They're both editable in some sense but who edits them is different. A subtle icon or color treatment helps users not confuse the two when scanning a long PO.

## Lessons from These Examples

**Ask before writing when logic is unclear.** The PO dates example took a full round of clarifying questions before the copy was written. Asking about derived-vs-entered, ship-vs-delivery, and header-vs-line saved writing four rounds of copy that would have needed rework.

**Push back on the UX, not just the copy.** The warning icon on the "Save draft" modal is a UX issue, not a copy issue. Flag it in the bigger flag section rather than trying to make the copy compensate.

**Give three options with a pick, not five without one.** Long option lists without recommendations are worse than one recommended option with reasoning.

**Match the user's mental model.** "Add bank account" beats "Create GL account with bank" because the user thinks "I need to add a bank", not "I need to configure the GL side of this bank".

**Use industry vocabulary.** Accountants say "unreconciled balance", not "bank vs books difference". Warehouse operators say "count sheet", not "inventory verification document". Match the language your user speaks at their desk.
