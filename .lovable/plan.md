## System-wide Linked Entity Pattern (UAC)

Apply the Partner Management linked-entity treatment everywhere a user or role name appears in UAC.

### Link behavior (single source of truth)

Create two small wrapper components that encapsulate the rule. Every place that currently renders a clickable user or role name will swap to one of these:

- `LinkedUserName`: wraps a user name (and optional avatar). Renders as an `<a target="_blank" rel="noopener noreferrer">` to `/company-settings/user-access-control/user/:id`.
- `LinkedRoleName`: same idea for roles, links to `/company-settings/user-access-control/role/:id`.

States:
- Default: inherits surrounding text color, no underline.
- Hover: color `#0A77FF`, underline.
- Click: ALWAYS opens in a new tab via `target="_blank"`. Never `navigate()`, no exceptions, even from inside modals, popovers, or wizards.

Disabled / Archived users: the wrapper accepts a `disabled` prop and renders plain text (no link, no hover) so deactivated names stay non-interactive.

`LinkedUserName` will continue to host the existing `UserSummaryTooltip` hover card so the rich popover still works, only the click behavior changes (new tab, never in-app navigation).

### Where the wrappers get applied

User names:
- Users listing table + UserCard (mobile)
- Roles listing table (assigned users column / popover)
- Role Detail page assigned users list
- User Detail page (any user references: owner, manager, etc.)
- Role Ownership tab: Ownership column names
- Reassignment wizard (Deactivate / Archive / Remove Role) Step 2 + Step 3 right column assignee picker and assigned badges, link applies to the name only, not the selectable card/radio area
- All `+N more` user popovers (`RoleUsersPopover`, owners, etc.)
- Permission Detail modal: assigned users
- Create Role / Create User review steps where users are listed

Role names:
- Roles listing table
- User Detail > Assigned Roles table (Role Name column)
- User Detail > Role Ownership tab (Role Name column)
- Reassignment modal Step 3 left-column role cards (link applies to the name, not the whole card)
- Permission Detail modal: Assigned Roles table
- Any `+N more` role popovers

Excluded (stays plain text):
- Static labels, column headers, descriptive copy
- Selection targets where click should select, not navigate
- Disabled / deactivated names

### "+N more" popover pattern

Standardize so every `+N more` trigger:
1. Renders the remaining entities as `LinkedUserName` / `LinkedRoleName` rows (avatar + name, blue-underline on hover, opens new tab).
2. Stays open after a link click, links open in a new tab without dismissing the popover. Only an outside click closes it.
3. Footer link `View all N {entity} for {context} →` also opens in a new tab.

Update the existing popovers (`RoleUsersPopover`, `RoleOwnersPopover`, any inline overflow popovers) to use the wrappers and to stop closing on link click.

### Technical notes

- New files:
  - `src/app/components/shared/LinkedUserName.tsx`
  - `src/app/components/shared/LinkedRoleName.tsx`
  - Tailwind hover utility: `hover:text-[#0A77FF] hover:underline` baked into the wrapper; default uses `text-inherit`.
- Replace existing `useNavigate()` calls used purely for "open user/role detail" inside listings, modals, popovers, and reassignment wizards with the wrapper. Row-level click handlers on the listing tables stay as-is (they still navigate the whole row in-app); only the name element itself becomes a new-tab link, with `e.stopPropagation()` so it doesn't double-fire the row click.
- `UserSummaryTooltip` keeps its hover behavior; `clickToNavigate` mode switches from `navigate()` to a new-tab link so callers don't need to change.
- No data, schema, or business-logic changes. Pure presentation.

### Verification

- TypeScript build clean.
- Spot-check Users table, Roles table, Role Detail, User Detail, Role Ownership tab, Deactivate wizard Steps 2 & 3, Permission Detail modal, and a `+N more` popover in the preview to confirm hover style and new-tab behavior.