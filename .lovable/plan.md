
# Ownership & Responsibility — Pioneer 3-Slot Rebuild

Approved. Shipping the locked slice.

## Files (4)

1. **`src/app/components/modules/GovernanceSection.tsx`** — bulk rewrite of Ownership region; Inventory Valuation card untouched.
2. **`src/app/components/modules/ItemConfigurationMaster.tsx`** — `AdvancedConfig` type swap.
3. **`src/app/components/modules/CreateItemModal.tsx`** — type swap, defaults, `MOCK_USERS` permissions, `CATEGORY_OWNER_DEFAULTS` seeding.
4. **`src/app/components/modules/ItemDetail.tsx`** — type + defaults swap (no JSX).

## State shape

```ts
owners: {
  materialHandling: string[];
  purchasing: string | null;
  finance: string | null;
};
inheritedOwners?: {
  materialHandling?: string[];
  purchasing?: string;
  finance?: string;
};
```

Deleted everywhere with no commented remnants: `engineeringOwner`, `purchasingOwner` (old multi shape), `schedulingOwner`, `salesOwner`, `arOwner`.

## MOCK_USERS permissions

| User | permissions |
|---|---|
| u1 Alice | `receiving`, `shipping` |
| u2 Bob | `purchasing` |
| u3 Carol | `receiving`, `movement` |
| u4 David | `finance` |
| u5 Eve | `shipping`, `movement` |
| u6 Frank | `gl`, `finance` |
| u7 Grace | `purchasing` |

Slot → permission keys: Material Handling = `receiving|shipping|movement`; Purchasing = `purchasing`; Finance = `finance|gl`. Each slot gets 2–3 Suggested users.

## Category inheritance seed

```ts
const CATEGORY_OWNER_DEFAULTS: Record<string, InheritedOwners> = {
  electronics: { materialHandling: ['u3','u5'], purchasing: 'u2', finance: 'u6' },
  hardware:    { materialHandling: ['u1'],      purchasing: 'u7' },
  fasteners:   { purchasing: 'u2' },
};
```

Sparse — missing slots fall through to "No one assigned". Applied when modal opens with a category preselected.

## GovernanceSection — internal `OwnerSlot`

One component, `variant: 'multi' | 'single'`. Renders:

- **Label row**: title + existing notification Info tooltip + (Purchasing/Finance only) second small Info pill → tooltip "Data only — routing activates with Billy Bob".
- **Body, three states**:
  1. Item-level value present → chip(s) with `InitialAvatar size="sm"` + name + X. If user's permissions don't intersect slot's keys → append amber `AlertTriangle` (`#B45309`) + tooltip `"<Name> lacks <slot label> permissions"`. Non-blocking.
  2. No item value, `inheritedOwners[key]` populated → muted inherited chip(s) + caption "Inherited from category" + ghost "Override" button that promotes inherited values into `owners[key]` and opens the picker.
  3. Neither → "No one assigned" + `+` button.
- **Picker** (existing Popover + Command primitives): single search; results split into "Suggested" (permission match) and "All people". Multi variant appends; single variant replaces. Single-user UX: chip stays clickable to reopen picker for replacement; X removes.

Inline `USER_HEX` deleted; `InitialAvatar` handles color.

## Out of scope (untouched)

Inventory Valuation card, all other config tabs, downstream module wiring, Billy Bob fields, delegation, Categories management UI, responsibility feed. `@ts-nocheck` headers stay.

## Verification

- `bun run build` clean across the 4 files.
- `/items` → Create Item → Configure → Governance: exactly 3 slots, no Engineering/Scheduling/Sales.
- Multi-user works on Material Handling; single-user replace works on Purchasing/Finance.
- "Data only…" Info pill on Purchasing + Finance only.
- Picker shows Suggested vs All people; single search filters both.
- Amber warning on non-permission assignees with correct tooltip; user remains assigned/removable.
- Categories `electronics`/`hardware`/`fasteners` show inherited mode; Override promotes to item level.
- `/items/1` → Configurations → Governance renders the same 3 slots.
- No console errors; assignments persist across save/reopen.
