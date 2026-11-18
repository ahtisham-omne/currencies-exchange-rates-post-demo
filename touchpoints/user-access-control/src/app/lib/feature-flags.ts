/* ─── Feature flags: finished UI that is intentionally hidden ────────────────
 *
 * Everything behind a flag here is complete and working — component, data, and
 * styling all still live in the tree. The flag is the only thing switching it
 * off, so restoring a surface is a one-word edit: set its constant to `true`.
 * Nothing else needs touching.
 *
 * Keep flags as plain literal booleans (no env lookups, no runtime config) so
 * the intent stays obvious and grepping for the constant finds every use.
 */

/** "Recommended Permissions to Turn On" banner inside the permission detail
 *  modal — the card suggesting companion permissions for the open permission.
 *
 *  Hidden 2026-07-31 at the team's request; flip to `true` to bring it back.
 *  Still intact: `components/permissions/RecommendedPermissionsCard.tsx` and
 *  its data source `data/permission-recommendations.ts`. Rendered from
 *  `components/permissions/PermissionDetailModal.tsx`, which covers every
 *  context the modal opens in (role detail, user detail, create flow).
 */
export const SHOW_RECOMMENDED_PERMISSIONS_BANNER: boolean = false;

/** "View in Module" preview content: the On/Off state toggle, caption banner,
 *  annotated screenshots, hotspot rings, and the click-to-expand full view
 *  inside `ViewInModuleModal`.
 *
 *  Hidden 2026-08-20 at the team's request; flip to `true` to bring it back.
 *  The button in the permission detail panel stays, and the modal still opens;
 *  while the flag is off its body renders the ComingSoonEmptyState (the
 *  Partners GL Accounts treatment: animated icon, Coming Soon chip, title,
 *  subtext) instead of the preview. Everything
 *  behind it is intact and nothing else needs touching:
 *    - the whole preview body and full-view overlay in
 *      `components/permissions/ViewInModuleModal.tsx`
 *    - the per-permission catalog `data/view-in-module-data.ts` (captions,
 *      screenshot paths, hotspot rects) and the screenshot assets it points at
 *    - the screenshot prefetching in `PermissionDetailModal` and
 *      `ViewInModuleModal` (gated on this flag so the hidden previews stop
 *      costing bandwidth, and resumes with the flag) */
export const SHOW_VIEW_IN_MODULE_CONTENT: boolean = false;

/** Permission thresholds: the per-permission limit attached to a handful of
 *  permissions (Maximum PO Value on "Create and edit purchase orders",
 *  Adjustment Threshold, Discount and Premium Limit, and the rest).
 *
 *  Hidden 2026-08-05 at the team's request; flip to `true` to bring it back.
 *  Everything behind it is intact: `thresholdConfig` on the catalog entries,
 *  `data/role-thresholds-data.ts`, `ThresholdManagementModal`,
 *  `ModuleThresholdsPopover`, and the threshold cards and columns inside
 *  `PermissionDetailModal`. Every surface that renders any of it is gated on
 *  this one constant:
 *    - the threshold panel in a permission's detail view (role, user, and the
 *      create-role / create-user wizards all route through that same modal)
 *    - the Threshold column on the permission's Roles and Users tables
 *    - the Thresholds column and popover on the permissions module grid
 *    - the Threshold Overview card and Manage Thresholds CTA on Role Detail
 *
 *  Descriptive "thresholds" were never part of this UI. Privilege Ceiling and
 *  the Manage Roles per-user scope use the same `thresholdConfig` field but
 *  are excluded everywhere by a `type !== "descriptive"` check, so they are
 *  unaffected by this flag. */
export const SHOW_PERMISSION_THRESHOLDS: boolean = false;

/** Me Mode: the "Me Mode" chip at the head of every data table's filter pill
 *  row, and the "only rows that involve me" filtering it switches on.
 *
 *  Hidden 2026-09-30 because it is not part of the current build; flip to
 *  `true` to bring it back. The chip is rendered in exactly one place,
 *  `components/data-table/DataTableFilterPills.tsx`, which every table uses
 *  (the shared `DataTable`, the create-user roles step, and the role access
 *  card grid), so this one constant covers every instance: Users, Roles,
 *  Permissions, and each role/user/permission detail table.
 *
 *  `DataTable` is gated too. While the flag is off it neither applies the
 *  Me Mode predicate nor reads or writes the saved `dt:memode:*` state, so an
 *  admin who left Me Mode on before it was hidden does not get rows filtered
 *  by a control they can no longer see. Their saved choice is left in storage
 *  and comes back with the flag. Everything behind it is intact:
 *  `usersMeModePredicate`, `rolesMeModePredicate`, `MY_PERMISSION_MODULE_IDS`,
 *  and the `showMeMode` / `meModePredicate` / `meModeTooltip` props at every
 *  call site. */
export const SHOW_ME_MODE: boolean = false;
