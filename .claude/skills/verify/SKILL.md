---
name: verify
description: Build, launch, and drive this UAC prototype app to verify UI changes end-to-end with Playwright screenshots.
---

# Verifying changes in this repo

Vite + React SPA (no backend). Playwright is already in `node_modules`.

## Launch

```bash
npm run dev -- --port 5199 --strictPort   # run in background
npx tsc --noEmit                          # typecheck
npm run build                             # production build check
```

## Drive with Playwright

Write a `.mjs` script **inside the repo root** (module resolution fails from
outside) and run it with `node`. Take screenshots to a scratch dir and read
them back to verify visually. Delete the script afterwards.

Key navigation paths:

- Users & Roles module / UAC: `/company-settings/user-access-control?tab=users|roles|permissions`
- Permissions tab shows **module cards**, search "Users & Roles", click the
  card, then click a permission name (e.g. "Manage Roles") to open
  `PermissionDetailModal`.
- Inside the permission detail, the Roles/Users tabs are buttons whose text is
  `Roles<count>` / `Users<count>`. Locator clicks on them can time out,
  click via `page.evaluate` matching `/^Users\s*\d+$/` on button textContent.
  Beware: the users **column header** is also a button named "Users".
- "Add Roles" / "Add Users" toolbar buttons open the Add-to-Manage-Roles
  modals (`AddManageRolesRolesModal` / `AddManageRolesUsersModal`).
- Clicking a **scope cell** ("All roles" / role list text) in the permission
  detail tables opens `ConfigureRoleScopeModal` (roles tab, role-level) or
  `ConfigureManageRolesModal` (users tab, user-level). Filter for visible
  buttons (`el.offsetParent !== null`), the other tab's DOM may still match.
- Tooltips: hover segmented buttons inside `div[role="group"]`, wait ~800ms,
  screenshot. Radix tooltips render in a portal.

## Gotchas

- `Escape` closes the whole `PermissionDetailModal`, not just popovers.
- The Add modals' right pane shows an empty state when nothing is selected,
  select an item first before probing the right-pane controls.
- Mock data seeds live in `src/app/data/*-scope-data.ts`; the canonical role
  list is `src/app/data/predefined-roles.ts` (25 predefined) +
  `roles-data.ts` (custom 26–28).
