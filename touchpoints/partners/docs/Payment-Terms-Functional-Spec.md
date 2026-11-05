# Partner Management — Payment Terms Functional Specification

**Module:** Partner Management → Partner Configuration (Vendor Rules) & Partner Detail
**Audience:** Business Analysts, QA, Product
**Status:** As-built (matches current implemented design)
**Last updated:** 15 Jul 2026

---

## 1. Overview

Payment Terms define **when payment is due** for transactions with a partner — as opposed to Payment Methods, which define *how* the money is transferred. A payment term specifies a **trigger event** (e.g. Shipping, Delivery, Order Confirmation), an optional **duration** (e.g. 30 days after the trigger), an optional **early-payment discount**, and — for split terms — a **schedule of partial payments**.

Payment terms are selected from a **library of reusable presets** (system templates plus user-created terms). A partner is assigned one term; the same preset can be applied to many partners, and the library tracks how many partners use each term ("X in use").

They are configured in:

1. **Create Partner wizard → Step 3 "Configure Vendor" → Vendor Rules → Payment Terms** (4th section, after Billing & Shipping, Payment Methods, Credit Limit).
2. **Partner Detail page** — the assigned term is displayed on a "Payment Terms" card (vendor side and customer side).

Payment terms can be **pre-filled from a Partner Group template** (e.g. "Tier 1 Automotive OEMs" defaults its members to Net 30) and overridden per partner.

---

## 2. Term Categories

Every payment term belongs to one of three categories, shown as a colored square badge on its card:

| Category | Badge | Badge color | Meaning |
|----------|-------|------------|---------|
| **NET Terms** | `NET` | Blue (primary) | Full payment due X days after a trigger event. *Picker label: "NET Terms (After X Days of a Certain Event)"* |
| **Prepayment Terms** | `Pre` | Violet | Payment (up to 100%) required at/before a trigger event. *Picker label: "Prepayment Terms (Before or After Confirm the Order)"* |
| **Split Terms** | `Split` | Amber (warning) | Payment divided across 2–5 trigger events, percentages summing to 100%. *Picker label: "Split Terms"* |

---

## 3. Trigger Events

All term types anchor to one of five lifecycle trigger events:

1. **Order Confirmation**
2. **Production Start**
3. **Production End**
4. **Shipping**
5. **Delivery**

For NET terms the duration counts **from** the trigger. For prepayment terms the payment is due **at** the trigger — and since prepayment happens before fulfillment, **Delivery is not offered as a prepayment trigger** (prepayment triggers: Order Confirmation, Production Start, Production End, Shipping). For split terms each installment has its own trigger, and triggers must be **unique within one split** (the dropdown hides already-used events).

---

## 4. Preset Library

### 4.1 System presets

| ID | Name | Category | Trigger | Duration | Description (verbatim) |
|----|------|----------|---------|----------|------------------------|
| pt-1 | Net 10 | NET | Shipping | 10 days | Payment is due 10 days after shipment. |
| pt-2 | Net 15 | NET | Shipping | 15 days | Payment is due 15 days after shipment. |
| pt-3 | Net 30 | NET | Shipping | 30 days | Payment is due 30 days after shipment. |
| pt-4 | Net 30 Post Shipping | NET | Shipping | 30 days | Full payment is due 30 days after the goods are shipped. |
| pt-5 | Net 45 Post Delivery | NET | Delivery | 45 days | Payment is due 45 days after goods are delivered. |
| pt-6 | Net 60 Post Production End | NET | Production End | 60 days | Payment is due 60 days after production is completed. |
| pt-7 | Full Advance Payment: Order Confirmation | Prepayment | Order Confirmation | — | 100% of the total amount is paid when the order is confirmed. |
| pt-8 | Full Advance Payment: Production Start | Prepayment | Production Start | — | A (X)% prepayment is required at production start. |
| pt-9 | 30/70 Split: Production Start & Delivery | Split | Production Start | — | 30% is due at production start, 70% at delivery. |
| pt-10 | 50/50 Split: Order Confirmation & Delivery | Split | Order Confirmation | — | 50% due at order confirmation, 50% at delivery. |
| pt-11 | 40/60 Split: Production Start & Shipping | Split | Production Start | — | 40% at production start, 60% at shipping. |
| pt-12 | 2/10 Net 30 Post Shipping | NET + discount | Shipping | 30 days | Payment is due 30 days after shipping, with a 2% discount if paid within 10 days. **Early-payment discount: 2% within 10 days.** |

### 4.2 User-created presets (examples in current data)

| ID | Name | Category | Trigger | Duration | Description |
|----|------|----------|---------|----------|-------------|
| pt-custom-1 | Net 25 Post Production End | NET | Production End | 25 days | Payment is due 25 days after production end. |
| pt-custom-2 | Order Confirmation Advance | Prepayment | Order Confirmation | — | Full prepayment due at order confirmation. |
| pt-custom-3 | 40/60 Split: Production End & Delivery | Split | Production End | — | 40% due at production end, 60% at delivery. |
| pt-custom-4 | Net 90 Post Shipping | NET | Shipping | 90 days | Extended 90-day payment window after shipping for high-volume partners. |
| pt-custom-5 | 20/30/50 Split: Order Confirmation, Production End & Delivery | Split | Order Confirmation | — | 20% at order confirmation, 30% at production end, 50% at delivery. |

### 4.3 Library sidebar (filter categories)

The term-picker modal has a left sidebar for filtering the library:

- **Recently used**
- **Predefined Templates** (header)
  - All Terms
  - NET Terms
  - Prepayment Terms
  - Split Terms
- **Made by FR Conversions** (header — company-created terms)
  - In Use
  - Created by me
  - Created by others

Each preset card shows: type badge, name, trigger, duration (NET), description, an **"X in use"** partner count, and — where applicable — an early-payment discount strip: *"Early pay {n}% within {n} days"*.

---

## 5. Selecting & Creating a Term (Configure Vendor wizard)

### 5.1 Selection flow

1. Open the **Payment Terms** section in Vendor Rules (Step 3).
2. A picker shows the sidebar filters (§4.3) and a grid of preset cards.
3. Click a card to assign that term to the partner, **or** click **"+"** to build a custom term.

### 5.2 Create Custom Term — shared fields

| Field | Required | Details |
|-------|----------|---------|
| **Term Type** | Yes | Radio choice of the three categories (§2). Default: NET. |
| **Term Name** | **Yes** | Text. Label adapts: "NET Term Name" / "Prepayment Term Name" / "Split Term Name". Placeholder adapts: *"e.g. Net 30 Standard"* / *"e.g. 50% Upfront"* / *"e.g. 3-Part Split"*. Must be non-empty to save. |
| **Description** | Optional | Expandable textarea. Placeholder: *"Brief summary of payment term purpose or context."* Shown for Prepayment and Split terms; for NET terms the description is auto-generated from trigger + duration. |

### 5.3 NET term fields

| Field | Required | Details |
|-------|----------|---------|
| **Trigger Event** | Yes | Dropdown of the 5 triggers (§3). Default: Order Confirmation. |
| **NET Duration (Days)** | **Yes** | Numeric with "days" suffix. Placeholder: *"e.g. 30"*. Quick-pick options: 3, 7, 14, 30, 60, 90, 180, 365 days, plus **Custom** (any integer; non-digits stripped as you type). |

### 5.4 Prepayment term fields

| Field | Required | Details |
|-------|----------|---------|
| **Prepayment Value** | **Yes** | Numeric with "%" suffix. Placeholder: *"e.g. 50"*. Range 0–100. **Percent only** — fixed-$ prepayments are not supported. |
| **Trigger Event** | Yes | Same dropdown as NET, **except Delivery**, which is not offered for prepayment (prepayment happens before fulfillment). Options: Order Confirmation, Production Start, Production End, Shipping. |

### 5.5 Split term fields

A dynamic **"Payment Split Events"** list with a live counter:

- Starts with **2 event rows** (minimum); **maximum 5** — the **"Add Event (Max 5)"** button disables at 5 and auto-selects the next unused trigger.
- Each event row has:
  - **Split Value** — numeric %, placeholder *"e.g. 50"*, required.
  - **Trigger Event** — dropdown filtered to exclude triggers already used by other rows (no duplicates).
- **Total validation:** a live footer shows *"Total: X% (must equal 100%)"* — amber while the sum ≠ 100%, emerald with a ✓ when it equals exactly 100%. Saving is blocked until the split sums to 100%.

### 5.6 Early Payment Discount (all term types, optional)

A collapsible card marked **"Optional"** with a toggle:

- **Apply Early Payment Discount** — helper text: *"Incentivize faster payments by offering a percentage or fixed discount within a defined window."*
- When enabled, two fields appear:
  - **Discount** — numeric %, placeholder *"e.g. 5"*. **Percent only** (fixed-$ discounts removed).
  - **Eligible Payment Period** — numeric with "days" suffix, placeholder *"e.g. 10"*. Default 10; quick-picks plus custom.
- Tooltip example provided in UI: *"2/10 Net 30: 2% off if paid in 10 days, otherwise full payment in 30 days."*

### 5.7 Save behavior

- **Save & Apply** creates the custom preset, adds it to the library, and immediately assigns it as the partner's selected term.
- Validation gate: non-empty name; NET duration numeric > 0; split total = 100%; discount value numeric when the discount toggle is on.
- The selection is cached on the wizard, so navigating between Step 3 sections preserves it.

---

## 6. Term Card Actions & Detail Modal

On a preset card in the library:

| Action | Behavior |
|--------|----------|
| **Select** (click card) | Assigns the term to the partner being configured. |
| **Duplicate** (copy icon) | Opens the create form pre-filled with the term's values; the name is prefixed to indicate a duplicate. Saving creates a new preset. |
| **Edit** (pencil icon) | Not yet implemented — shows toast *"Edit flow coming soon."* |
| **Remove** (X) | Removes the term (custom terms). |

**Payment Term Detail Modal** — opening a term's detail view provides tabs: **Overview, Partners, Chat, Attachments, Recent Activity** — giving full context on the preset, including which partners use it.

**Empty state** (detail modal, no custom term configured):
- Icon: Receipt
- Title: **"No custom payment term"**
- Body: *"A custom payment term can be configured during partner creation."*

---

## 7. Vendor Side vs Customer Side

Like payment methods, payment terms exist on **two independent sides** of a partner:

- **Vendor Payment Terms** — govern bills we receive from the partner (when we must pay them).
- **Customer Payment Terms** — govern invoices we issue to the partner (when they must pay us).

On the Partner Detail page the "Payment Terms" card shows the vendor-side term (custom preset card if one was configured; otherwise the partner's standard term label — Net 15 / Net 30 / Net 45 / Net 60 / Net 90 / Due on Receipt / COD), with the customer side presented separately.

---

## 8. Templates & Pre-fill (Partner Groups)

### 8.1 Mechanism

A Partner Group template can carry a default **`paymentTermId`** pointing to a library preset. When a partner is created inside that group:

1. The group's template is read at Step 3.
2. The templated term is auto-selected in the Payment Terms section.
3. The Step 3 pre-fill banner lists it: *"Pre-filled from Tier 1 Automotive OEMs V1: Currency · Payment Term · Credit Enforcement · Payment Methods. Override any field to make it partner-specific."*
4. The user may keep it (**Inherited**) or pick/create a different term (**Overridden** — amber marker; an amber dot also appears on the section nav rail when any field in that section deviates).

Templates are **pre-fill only**: applied once at creation. Later changes to the group template do not retroactively update existing partners, and there is no reset-to-template action.

### 8.2 Group examples with templated terms

| Group | Templated term |
|-------|---------------|
| Tier 1 Automotive OEMs | Net 30 (pt-3) |
| Seats & Interior Trim | Net 30 Post Shipping (pt-4) |
| Headlamp & Lighting | Net 45 Post Delivery (pt-5) |
| Powertrain Components | Net 15 (pt-2) |

(26 groups currently carry a payment-term template.)

### 8.3 Group page display

On the Partner Group detail page, the template summary card shows a **"Payment term"** chip (Receipt icon, cyan tone) with the term's label (e.g. "Net 30") when the group has a templated term.

---

## 9. Due-Date & Discount Semantics

- **NET:** due date = trigger event date + duration days. Example: Net 45 Post Delivery → invoice due 45 days after delivery.
- **Prepayment:** the configured % of the order total is payable at the trigger event (100% = full advance).
- **Split:** each installment's % of the total is due at its own trigger event; the schedule always covers exactly 100%.
- **Early-payment discount:** if the payer settles within the **Eligible Payment Period** (days from the trigger), the **Discount %** applies; otherwise the full amount is due at the normal due date. Canonical example shipped as preset pt-12: **2/10 Net 30** — 2% off within 10 days, full payment in 30.

---

## 10. Relationship to Other Settings

| Setting | Relationship |
|---------|-------------|
| **Payment Methods** | Independent. Terms define **when** payment is due; methods define **how** it moves. Both are group-templatable. |
| **Currency** | Independent. Terms carry no currency; the partner's billing currency (Billing & Shipping section) applies to amounts. |
| **Credit Limit / Enforcement** | Independent config, but used together for partner risk: enforcement (Soft warning / Hard block / Monitor only) governs credit-limit breaches while terms govern due dates. Both pre-fill from the same group template. |
| **Pricing Rules** | Independent; also group-templatable. |
| **Freight & Logistics** | No data link; the "Shipping" trigger semantically corresponds to the shipment date used by invoicing. |

---

## 11. Data Model (reference)

### PaymentTermPreset (library preset)

```
id                string      e.g. "pt-3", "pt-custom-1"
name              string      e.g. "Net 30"
category          "net" | "prepayment" | "split"
typeBadge         "NET" | "Pre" | "Split"
badgeColor        string      css token (primary / violet / warning)
trigger           string      "Order Confirmation" | "Production Start" | "Production End" | "Shipping" | "Delivery"
description       string
vendorsApplied    number      count of partners using the term ("X in use")
duration?         string      days — NET terms only, e.g. "30"
applyDiscount?    boolean     early-payment discount active
discountPercent?  string      e.g. "2"
discountPeriod?   string      window in days, e.g. "10"
```

### SavedPaymentTermConfig (persisted on the partner's configuration)

```
id                string
name              string
type              string      "NET" | "Pre" | "Split"
trigger           string
description       string
duration?         string      days, NET terms
discountPercent?  string
discountPeriod?   string
```

### Standard term enum (partner record, when no custom config exists)

```
"net_15" | "net_30" | "net_45" | "net_60" | "net_90" | "due_on_receipt" | "cod"
```

### PartnerGroupTemplate (pre-fill model)

```
currency?            string
paymentTermId?       string      default payment term preset id
pricingRuleIds?      string[]
creditEnforcement?   string
paymentMethodTypes?  string[]
```

---

## 12. Validation Summary

| Rule | Detail |
|------|--------|
| Term name required | Custom term cannot be saved without a non-empty name. |
| NET duration | Numeric only (non-digits stripped); must be > 0. |
| Prepayment value | Percent only, 0–100. |
| Split total = 100% | Live indicator — amber *"Total: X% (must equal 100%)"* until exact, emerald ✓ when valid; save blocked otherwise. |
| Split events 2–5 | Minimum 2 rows; "Add Event (Max 5)" disables at 5. |
| Unique triggers per split | Each installment must use a different trigger event; dropdowns hide used ones. |
| Discount percent-only | Early-payment discounts (and prepayment values) support % only; fixed-$ modes were removed. |

---

## 13. Open Items / Future Considerations

- **Edit flow for presets** is stubbed — the pencil action currently shows *"Edit flow coming soon."* (Duplicate-and-modify is the workaround.)
- **Usage tracking ("X in use")** currently maps only NET presets whose duration matches the standard enum (15/30/45/60/90) to partner records; prepayment, split, and custom-duration terms show no linked partners until richer linkage lands.
- **Invoicing integration** — the saved term config (trigger, duration, discount) is structured for due-date and early-discount computation in invoicing/transactions, but automated application there is not yet fully wired.
- **Late fees / grace periods** are not modeled in the current release.
- **Customer-side term configuration** exists structurally but its detail UI is lighter than the vendor side.
