# Partner Management — Payment Methods Functional Specification

**Module:** Partner Management → Partner Configuration (Vendor Rules) & Partner Detail
**Audience:** Business Analysts, QA, Product
**Status:** As-built (matches current implemented design)
**Last updated:** 15 Jul 2026

---

## 1. Overview

Payment Methods define **how money moves between the company and a partner**. Every partner can hold multiple payment methods, split across two independent sides:

- **Vendor Payment Methods** — how we pay this partner (outbound payments).
- **Customer Payment Methods** — how we collect payment from this partner (inbound payments).

Each side keeps its own list of methods and its own **primary** (default) method.

Payment methods are configured in two places, using the same underlying component so behavior is identical:

1. **Create Partner wizard → Step 3 "Configure Vendor" → Vendor Rules → Payment Methods** (screenshot reference: empty state + "Add Payment Method" modal).
2. **Partner Detail page → Payment Methods tab** (with Vendor / Customer sub-tabs).

> **Security principle (applies everywhere):** the system never collects or stores full card or bank account numbers. Only the **last 4 digits** are captured (PCI DSS Req 3.5.1 / NACHA §1.6). Free-text fields actively reject anything that looks like a full card/account number.

---

## 2. Where Payment Methods Live in the Product

### 2.1 Configure Vendor wizard (Step 3)

The Vendor Rules panel contains these sections in order:

1. Billing & Shipping
2. **Payment Methods** ← this spec
3. Credit Limit
4. Payment Terms
5. Pricing Rules
6. Freight & Logistics

Payment Methods apply at the **partner level** — they are shared across all of the partner's profiles (Online Vendor, In-Store Vendor, Sub Contractor, Service Provider). Profiles do not carry their own payment methods.

### 2.2 Empty state

When no methods exist:

- Icon: credit card in a blue circle
- Title: **"No payment methods added yet"**
- Body: *"Add payment methods to define how this vendor sends or receives payments. You can configure multiple methods."* (word "vendor"/"customer" adapts to the active side)
- CTA: **+ Add Payment Method** (primary blue button)

### 2.3 Partner Detail page — Payment Methods tab

- Two sub-tabs: **Vendor Payment Methods** and **Customer Payment Methods**, each with an icon and a live count of saved methods.
- Toolbar (right side): count label — *"{n} payment method(s) configured"* — plus an **Add Vendor Payment Method** / **Add Customer Payment Method** button (blue tint for vendor side, green tint for customer side).
- Body: responsive card grid (1 column < 400px container, 2 columns 400–750px, 3 columns > 750px).
- **Filter:** by method type — "All" or a specific type.
- **Sort:** Newest | Oldest | Type | Name.

---

## 3. Payment Method Types

Clicking **Add Payment Method** opens a type-picker modal titled **"Add Payment Method"** with subtitle *"Choose a payment method type to get started."* Seven types are offered:

| # | Type | Category | Picker description (verbatim) |
|---|------|----------|-------------------------------|
| 1 | **ACH / Direct Deposit** | Bank | Electronic bank transfer through the ACH network. Common for US-based vendors. |
| 2 | **Wire Transfer** | Bank | Direct bank-to-bank transfer. Suitable for domestic or international payments where ACH is not available. |
| 3 | **Credit / Debit Card** | Card | Card payment via Visa, Mastercard, Amex, or other card networks. |
| 4 | **Digital Wallet** | Digital | Payment through platforms such as PayPal, Venmo, Stripe, Apple Pay, or Google Pay. |
| 5 | **Check (Paper)** | Traditional | Physical paper check sent by mail. Used when electronic payment is not accepted. |
| 6 | **Cash** | Traditional | Physical cash payment collected at a designated collection point. |
| 7 | **Other (Record Only)** | Other | A custom payment method for record-keeping only. No transaction is processed through the system. |

Internal type IDs: `ach`, `wire`, `card`, `digital_wallet`, `check`, `cash`, `other`.

---

## 4. Form Fields by Type

### 4.0 Fields shared by all types

| Field | Required | Notes |
|-------|----------|-------|
| **Nickname** | Optional | Friendly display name. Placeholder: *"e.g. Primary ACH, Backup Wire"*. Used as the card title when present; otherwise the type label is used. |
| **Apply Discount Terms or Additional Charges** | Optional toggle | When enabled, reveals two inputs side by side: **Discount** and **Add. Charges**. Each has a **% / $** mode toggle (default: %). Placeholders — Discount: `e.g. 5` (%) or `e.g. 25.00` ($); Charges: `e.g. 2` (%) or `e.g. 50.00` ($). |
| **Primary flag** | System-managed | See §5.1. |

A **Phone Number** field (optional) with a searchable country-code selector (flag + dial code, defaults to +1) appears on: ACH, Wire Transfer, Digital Wallet, and Cash. The number auto-formats to the selected country's phone pattern.

### 4.1 ACH / Direct Deposit

| Field | Required | Input rules |
|-------|----------|-------------|
| Bank Name | **Yes** | Text. Placeholder: *"e.g. Chase Bank"* |
| Account Title | **Yes** | Text. Placeholder: *"Enter account holder name"* |
| Account Number (last 4) | **Yes** | Numeric, max 4 digits. Tooltip: *"Enter only the last 4 digits. For security, the full account number is never collected or stored this release."* |
| Routing Number | **Yes** | Label and format are **country-aware** (see §4.8). Auto-formats as the user types. |
| Account Type | Optional | Dropdown: Checking (default), Savings, Money Market, Certificate of Deposit (CD), Loan |
| Phone Number | Optional | Country-formatted (see §4.0) |

### 4.2 Wire Transfer

Same as ACH (Bank Name, Account Title, Account Number last-4, country-aware Routing Number, Phone), **plus**:

| Field | Required | Input rules |
|-------|----------|-------------|
| SWIFT / BIC Code | Optional — *"(optional, international wire only)"* | Text, auto-uppercased. Placeholder: *"e.g. CHASUS33"*. Treated as sensitive on display (hidden behind a reveal/hide toggle). |

Wire Transfer has **no Account Type dropdown**.

### 4.3 Credit / Debit Card

| Field | Required | Input rules |
|-------|----------|-------------|
| Cardholder Name | **Yes** | Text. Placeholder: *"Enter cardholder name"* |
| Card Number (last 4) | **Yes** | Numeric, max 4 digits. Tooltip: *"Enter only the last 4 digits. For security, the full card number is never collected or stored this release."* |
| Expiry Date | **Yes** | Auto-masks to **MM/YY** as the user types |
| Billing Address | Optional | Text |

### 4.4 Digital Wallet

| Field | Required | Input rules |
|-------|----------|-------------|
| Wallet Provider | **Yes** | Text. Placeholder: *"e.g. PayPal, Venmo, Stripe"* |
| Wallet ID / Email | **Yes** | Text. Tooltip: *"Enter a wallet handle, email, or token, never a raw card number."* **Sensitive-number guard:** if the value contains 13+ consecutive digits, saving is blocked with the error *"This looks like a card or account number. Use a wallet handle, email, or token instead."* Displayed behind a reveal/hide toggle. |
| Phone Number | Optional | Country-formatted |

### 4.5 Check (Paper)

| Field | Required | Input rules |
|-------|----------|-------------|
| Payee Name | **Yes** | Text. Placeholder: *"Enter payee name"* |
| Mailing Address | **Yes** | Text. Placeholder: *"Enter mailing address"* |

### 4.6 Cash

| Field | Required | Input rules |
|-------|----------|-------------|
| Recipient Name | Optional | Text |
| Collection Point | Optional | Text. Placeholder: *"Enter collection point or location"* |
| Phone Number | Optional | Country-formatted |

Cash has **no required type-specific fields** — it can be saved with just the type selected.

### 4.7 Other (Record Only)

| Field | Required | Input rules |
|-------|----------|-------------|
| Method Name | Optional | Text. Placeholder: *"e.g. Barter, Trade Credit"* |
| Description | Optional | Multi-line expandable textarea. Placeholder: *"Describe this payment arrangement..."*. Tooltip: *"Record-only notes. Don't paste card or bank account numbers here."* **Sensitive-number guard:** 13+ consecutive digits blocks saving with the error *"Remove the card or account number, this is a free-text record only."* |

No transaction is processed through the system for this type — it is purely for record keeping.

### 4.8 Country-aware routing field (ACH & Wire)

The routing-number label, placeholder, and auto-format pattern adapt to the partner's country:

| Country | Routing field label |
|---------|--------------------|
| USA | Routing Number (ABA) — e.g. `021000021` |
| UK | Sort Code — e.g. `20-00-00` |
| Germany | BLZ (Bank Code) |
| Japan | Bank & Branch Code |
| India | IFSC Code |
| China | CNAPS Code |
| UAE | Bank Code |
| South Korea | Bank Code |
| Australia | BSB Number |
| Canada | Transit + Institution |

The same 10 countries drive phone-number formatting and the default phone country code.

---

## 5. Behavior Rules

### 5.1 Primary (default) payment method

- The **first method saved on each side** (vendor / customer) automatically becomes that side's primary method.
- Every non-primary method card shows a **star icon** (tooltip: *"Set as primary"*).
- Only **one primary per side**; setting a new primary demotes the previous one.
- If the primary method is removed, the **first remaining method** on that side automatically becomes primary.
- Per design convention, changing primary does **not reorder cards mid-edit** — ordering is preserved and any reorder happens on save.

**Confirmation (Partner Detail page only):** setting a new primary while another exists opens a confirmation modal:

> **Change Primary Vendor Payment Method**
> *Make {method name} the primary payment method?*
> "New vendor transactions will default to {new method} instead of {old method}. Existing records are unaffected. You can switch back any time."
> Buttons: **Make Primary** | Keep current primary

If no primary exists yet (first method), the star is applied silently with no dialog.

### 5.2 Add / Edit flow

1. **Add Payment Method** → type-picker modal (§3) → selecting a type opens the entry form for that type.
2. Save button reads **"Save Method"** for a new entry, **"Update Method"** when editing a saved one.
3. Clicking a saved card (or **Edit** inside its view modal) reopens the form pre-populated. A snapshot of the saved values is kept, so **Cancel restores the previous state** exactly.
4. **Editing a saved method on the Partner Detail page** asks for confirmation before applying:
   > **Save Changes** — *Save changes to {method name}?*
   > "Your edits to this vendor payment method will be updated."
   > Buttons: **Save changes** | Keep editing
5. Inside the **Create Partner wizard**, add/edit/remove happen without confirmation dialogs (nothing is committed until the configuration itself is saved).

### 5.3 Remove flow

- **Remove** button lives in the method's view modal header.
- On the Partner Detail page, removal requires confirmation:
  > **Remove Vendor Payment Method** (red header)
  > *Remove {method name}?*
  > "The payment method will be removed from this vendor side. You can re-add it later."
  > Buttons: **Remove** (destructive red) | Cancel
- There is **no deactivate / soft-delete state** — methods are either saved or removed.

### 5.4 Limits

- **No hard cap** on the number of methods per side; the grid grows as methods are added and the toolbar shows the running count.

### 5.5 Verification

- There is currently no separate "verified / unverified" status on a payment method. A method is either saved (persisted) or in-progress.

---

## 6. Card Display (saved method)

Each saved method renders as a card showing:

- **Header:** type icon + display name (nickname, or the type label if no nickname) + a square type badge (e.g. "ACH / Direct Deposit"), plus the primary star.
- **Detail rows** (in a light-gray box), varying by type:

| Type | Rows shown |
|------|-----------|
| ACH | Bank, Account (title), Acct # `•••• 1234`, Routing (reveal toggle), Type (account type), Phone |
| Wire | Bank, Account, Acct # `•••• 1234`, Routing (reveal toggle), SWIFT (reveal toggle), Phone |
| Card | Holder, Card # `•••• 1234`, Expiry, Billing (if present) |
| Digital Wallet | Provider, Wallet ID (reveal toggle), Phone |
| Check | Payee, Address |
| Cash | Recipient, Location, Phone |
| Other | Method, Desc |

- **Discount/charges strip** (only if enabled): percent icon + "Discount {value}" and "Charges {value}", each rendered as `{n}%` or `${n}` per the chosen mode.
- Account and card last-4 values are always masked as `•••• 1234` with **no** reveal option; routing, SWIFT, and wallet ID have a reveal/hide toggle.

---

## 7. Templates & Pre-fill (Partner Groups)

### 7.1 What a template contains

A **Partner Group** can carry a configuration template that pre-fills a new partner's Vendor Rules. Template fields:

- Currency
- Payment Term
- Credit Enforcement
- **Payment Method Types** (a list of accepted type IDs — e.g. Tier 1 Automotive OEMs: `ACH`, `Wire`, `Card`)

**Key rule: templates carry method *types* only — never account details.** Account numbers, routing numbers, cards, and wallet IDs are always entered per partner on their own record.

Example — "Tier 1 Automotive OEMs" group template:

| Template field | Value |
|----------------|-------|
| Currency | USD |
| Payment Term | Net 30 (pt-3) |
| Credit Enforcement | Soft warning |
| Payment Method Types | ACH / Direct Deposit, Wire Transfer, Credit / Debit Card |

### 7.2 Pre-fill banner in the wizard

When a partner is created inside a templated group, Step 3 shows an inline banner:

> *"Pre-filled from Tier 1 Automotive OEMs V1: Currency · Payment Term · Credit Enforcement · Payment Methods. Override any field to make it partner-specific."*

### 7.3 Group-level type selector

When configuring **at the group level**, the Payment Methods section shows a **type-only checkbox grid** (not the full account forms), with the copy:

> *"Choose which payment method types apply to partners in this group. Each partner enters their own account details (account numbers, routing, cards) on their own record."*

### 7.4 Inherited vs Overridden indicators

- **Group selection card (Step 1):** a green **"Methods"** pill (wallet icon) indicates payment methods are templated. Tooltip: *"Payment methods templated."* Similar pills exist for Currency, Payment Term, and Credit Enforcement.
- **Step 3 (Configure):** each templated field carries an inline **Inherited / Overridden** marker; overridden fields get an amber highlight with a tooltip describing the template default.
- **Deviation banner:** if any field differs from the group template, an amber inline banner appears:
  > *"One or more configuration fields differ from the '{group name}' group template. Review each section's inline Inherited / Overridden marker to see which fields changed."*
- **Partner Detail:** an amber dot indicates the partner deviates from the group defaults. Tooltip: *"One or more partner fields differ from the primary group's templated defaults."*

### 7.5 Inheritance lifecycle

- Templates are **pre-fill only** — applied once, at partner creation.
- Any subsequent edit on the partner is an override; later changes to the group template do **not** retro-actively update existing partners.
- There is currently **no "Reset to template" action** on a partner.

---

## 8. Relationship to Other Settings

| Setting | Relationship to Payment Methods |
|---------|-------------------------------|
| **Payment Terms** | Independent configuration (when payment is due — Net 10/30/60, Prepayment, Split). Both can be templated by the same group; neither drives the other. |
| **Currency** | Payment methods do **not** store a currency. The partner's billing currency (from Billing & Shipping) applies. Resolution order: partner override → group template → country default → USD fallback. |
| **Credit Enforcement** | Independent (Soft warning / Hard block / Monitor only). Governs credit-limit behavior at ordering time, templated alongside payment method types. |
| **Profiles** (Online Vendor, In-Store Vendor, Sub Contractor, Service Provider) | Payment methods are **partner-level and shared** across all active profiles. The vendor/customer split is by transaction direction, not by profile. |

---

## 9. Validation & Security Summary

| Rule | Detail |
|------|--------|
| Last-4-only capture | Account and card number fields accept a maximum of 4 digits; full numbers are never collected or stored (PCI Req 3.5.1 / NACHA §1.6). |
| Sensitive-number guard | Free-text fields (Wallet ID, Other-type Description) reject any value containing **13+ consecutive digits** (spaces/dashes ignored), with a field-specific error message. Saving is blocked until corrected. |
| Masked display | Last-4 values render as `•••• 1234` with no reveal. Routing, SWIFT, and Wallet ID render hidden with a reveal/hide toggle. |
| Input masking | Expiry auto-masks to MM/YY; routing and phone numbers auto-format per country; SWIFT auto-uppercases. |
| No silent blocking | Invalid states always surface an explanation (inline error / tooltip) rather than silently disabling actions. |
| Special instructions | A former free-text "Special Instructions" field was **removed** from the UI (sensitive-data leak risk); the data field is retained only for backward compatibility. |

---

## 10. Data Model (reference)

### PaymentMethodEntry (working/UI model)

```
id                     string        auto-generated
type                   "ach" | "wire" | "card" | "digital_wallet" | "check" | "cash" | "other"
isSaved                boolean       persisted vs in-progress
isPrimary              boolean       one true per side
nickname               string        optional, all types

-- Bank (ACH / Wire) --
bankName, accountTitle, accountNumber (last 4), routingNumber,
swiftCode (wire only), accountType ("checking"|"savings"|"money_market"|"cd"|"loan")

-- Card --
cardholderName, cardNumber (last 4), expiryDate (MM/YY), billingAddress

-- Digital Wallet --
walletProvider, walletId

-- Check --
payeeName, mailingAddress

-- Cash --
recipientName, collectionPoint

-- Other --
methodName, description, documentLink (reserved for future attachments)

-- Common --
phone, countryCode (default "+1")
applyDiscount          boolean
discountPercent        string
discountMode           "percent" | "fixed"
additionalCharges      string
additionalChargesMode  "percent" | "fixed"
```

### PartnerGroupTemplate (pre-fill model)

```
currency?            string
paymentTermId?       string
pricingRuleIds?      string[]
creditEnforcement?   string        ("soft_warning" | "hard_block" | "monitor_only")
paymentMethodTypes?  string[]      (payment method type IDs only — no account details)
```

---

## 11. Open Items / Future Considerations

- **Verification status** (e.g. micro-deposit / penny-drop verification for ACH) is not yet modeled.
- **Deactivate / archive** for a method does not exist — only remove.
- **Document attachments** per method (`documentLink`) is stubbed in the data model but not exposed in the UI.
- **Reset-to-template** for partners that have overridden group defaults is not available.
- Full account/card capture is explicitly deferred (*"never collected or stored this release"*) — a future release may integrate a tokenized payment vault.
