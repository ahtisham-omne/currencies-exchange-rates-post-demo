import { useCallback, useMemo, useState } from "react";

import { PERMISSION_MODULES, buildDefaultTogglesForModule, type PermissionModule } from "../../data/permissions-data";
import { getCrossModuleLinkedUpdates } from "../../data/linked-permissions";
import { PermissionDetailModal, type PermissionModalContext, type PermissionModalMode } from "../permissions/PermissionDetailModal";
import {
  ModuleGridShell,
  type ModuleGridGroup,
  type ModuleGridRow,
} from "../shared/ModuleGridShell";
import {
  getRoleThresholdsForModule,
  type RoleThresholdEntry,
} from "../../data/role-thresholds-data";
import { ThresholdManagementModal, type RoleThresholdItem } from "../role-detail/ThresholdManagementModal";
import { getModuleAssignment } from "../../data/module-assignments-data";
import { toast } from "sonner";

const PERMISSION_GROUPS: ModuleGridGroup[] = [
  { key: "items-inventory", label: "Items & Inventory", moduleIds: ["item-library","item-categories","cycle-count","unit-of-measure","physical-inventory","warehouse-locations"] },
  { key: "supply-chain",    label: "Supply Chain Management", moduleIds: ["purchase-orders","receiving","inventory-movement","shipments"] },
  { key: "sales",           label: "Sales & CRM", moduleIds: ["quotes","sales-orders"] },
  { key: "partners",        label: "Partner Management", moduleIds: ["partners","partner-group","contacts"] },
  { key: "people",          label: "Company Setup & People Management", moduleIds: ["general-settings","module-defaults","users-roles","global-mfa"] },
];

const MODULE_TO_GROUP: Record<string, { key: string; label: string }> = {};
PERMISSION_GROUPS.forEach((g) => {
  g.moduleIds.forEach((mid) => {
    MODULE_TO_GROUP[mid] = { key: g.key, label: g.label };
  });
});

interface PermissionsModuleGridProps {
  modalContext?: PermissionModalContext;
  modalMode?: PermissionModalMode;
  userId?: number;
  /** Hide the Filters / Density / Columns toolbar controls */
  hideFilters?: boolean;
  hideDensity?: boolean;
  hideColumnSelector?: boolean;
  /** Optional content rendered inline after the search input (e.g. segmented tabs) */
  leadingToolbarSlot?: React.ReactNode;
  /** Optional extra classes appended to the card-view's outer scroll container (e.g. `bg-slate-50`). */
  cardContainerClassName?: string;
  /** When provided, the Thresholds column shows actual configured values for this role */
  roleId?: number;
  /** List the configured thresholds but withhold the edit affordance: the
   *  popover still shows every value, clicking one no longer opens the
   *  management modal. Separate from `modalMode` because a permission toggle
   *  and a threshold limit can be locked for different reasons. */
  thresholdsReadOnly?: boolean;
  roleName?: string;
  getInitialToggles?: (moduleId: string) => Record<string, boolean>;
  inheritedPermissions?: Set<string>;
  inheritedSources?: Record<string, string[]>;
  /** Catalog mode (UAC Main): map of moduleId → number of roles that grant any permission in this module */
  roleUsageCounts?: Record<string, number>;
  /** Catalog mode: hide the "active" chip entirely (no scoped context) */
  hideActiveChip?: boolean;
  /** Hide Direct/Inherited source chips and Granted Via section in the
   *  permission detail modal, used in role-scoped contexts where every
   *  enabled permission is simply "on the role" with no inheritance. */
  hideSourceChips?: boolean;
  /** Optional save interceptor. Called when a per-module save commits.
   *  If it returns true, the grid defers committing the toggles to the
   *  caller (which must call `commit(savedToggles)` once warnings are resolved).
   *  Used by the Role Permissions tab to fire the license-tier-raise warning. */
  onModuleSaveIntercept?: (
    moduleId: string,
    nextToggles: Record<string, boolean>,
    commit: () => void
  ) => boolean;
  /** Fired whenever a module's toggles change and are committed, through a
   *  per-module modal save, "Enable All", or "Disable All". Lets a parent that
   *  owns the toggle state (e.g. the Create Role wizard) stay in sync with the
   *  grid. Independent of `onModuleSaveIntercept`. */
  onModuleTogglesChange?: (moduleId: string, toggles: Record<string, boolean>) => void;
  /** Show + activate the Me Mode chip on the underlying DataTable. Defaults
   *  to `false` so role-scoped / user-scoped consumers stay unchanged; the
   *  main UAC Permissions tab opts in. */
  showMeMode?: boolean;
  /** Me Mode filter predicate (only applied when `showMeMode` is true). */
  meModePredicate?: (row: ModuleGridRow) => boolean;
  /** Hover tooltip text for the Me Mode chip. */
  meModeTooltip?: React.ReactNode;
  /** Persist this grid's quick filter, Me Mode, and advanced filter selections
   *  across visits. Only the main UAC Permissions tab passes one: the same grid
   *  rendered inside Role Detail, User Detail, or a create wizard should open
   *  unfiltered every time, since a remembered filter there would hide modules
   *  the admin is midway through configuring. */
  persistKey?: string;
  /** Render flush: drop the outer bordered card around the grid. */
  flush?: boolean;
  /** Hide the DataTable pagination footer (handy in slim modal contexts). */
  hidePagination?: boolean;
  /** Show "Enable All" / "Disable All" in each row's actions menu. Defaults to
   *  true; the main UAC Permissions tab opts out. */
  showToggleAllActions?: boolean;
  /** Flush info strip rendered between the toolbar and the module cards, in
   *  place of the plain divider (used by Create Role step 2). */
  headerBanner?: React.ReactNode;
}

export function PermissionsModuleGrid({
  modalContext = "permissions-tab",
  modalMode = "readonly",
  userId,
  roleId,
  thresholdsReadOnly = false,
  roleName,
  getInitialToggles,
  inheritedPermissions,
  inheritedSources,
  roleUsageCounts,
  hideActiveChip,
  hideSourceChips,
  onModuleSaveIntercept,
  onModuleTogglesChange,
  hideFilters,
  hideDensity,
  hideColumnSelector,
  leadingToolbarSlot,
  cardContainerClassName,
  showMeMode,
  meModePredicate,
  meModeTooltip,
  persistKey,
  flush,
  hidePagination,
  headerBanner,
  showToggleAllActions = true,
}: PermissionsModuleGridProps) {
  const [openModule, setOpenModule] = useState<PermissionModule | null>(null);
  /** Permission to land on when the modal opens, set by cross-module
   *  recommendation chips. Cleared when a module card is opened normally. */
  const [pendingActivePermId, setPendingActivePermId] = useState<string | undefined>(undefined);
  const [moduleToggleOverrides, setModuleToggleOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [thresholdModalEntries, setThresholdModalEntries] = useState<RoleThresholdItem[] | null>(null);

  const getModuleToggles = useCallback(
    (moduleId: string) => moduleToggleOverrides[moduleId] ?? getInitialToggles?.(moduleId),
    [getInitialToggles, moduleToggleOverrides]
  );

  /* Build rows */
  const rows = useMemo<ModuleGridRow[]>(() => {
    return PERMISSION_MODULES.map((mod) => {
      const grp = MODULE_TO_GROUP[mod.id] ?? { key: "other", label: "Other" };
      const toggles = getModuleToggles(mod.id);
      let active = 0;
      if (toggles || inheritedPermissions) {
        active = mod.permissions.filter((p) => {
          if (inheritedPermissions?.has(p.id)) return true;
          if (toggles?.[p.id]) return true;
          return false;
        }).length;
      }
      const hasThresholds = mod.permissions.some((p) => !!p.thresholdConfig);

      // Catalog mode: pull both role + user assignment data
      const isCatalog = roleUsageCounts?.[mod.id] !== undefined;
      const assignment = isCatalog ? getModuleAssignment(mod.id) : null;

      return {
        id: mod.id,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
        total: mod.permissions.length,
        active,
        hasThresholds,
        groupKey: grp.key,
        groupLabel: grp.label,
        assignedRolesCount: assignment?.rolesCount,
        assignedUsersCount: assignment?.usersCount,
        assignedRoleIds: assignment?.roleIds,
        assignedUserIds: assignment?.userIds,
        hideActiveChip: hideActiveChip && !isCatalog,
      };
    });
  }, [getModuleToggles, inheritedPermissions, roleUsageCounts, hideActiveChip]);

  const handleModuleClick = useCallback((moduleId: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    setPendingActivePermId(undefined);
    setOpenModule(mod);
  }, []);

  /* A recommendation chip pointing at another module swaps the open modal for
   * that module's, landing on the recommended permission. Like Cancel, any
   * unsaved edits in the modal being left behind are dropped; nothing is
   * toggled or saved on the way through. */
  const handleNavigateToModulePermission = useCallback(
    (moduleId: string, permissionId: string) => {
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      if (!mod) return;
      setPendingActivePermId(permissionId);
      setOpenModule(mod);
    },
    []
  );

  /* On/off state for any permission in the catalog, so the recommendations card
   * can drop chips for permissions already on in other modules. Falls back to
   * the catalog default when this surface has no toggle source, matching how the
   * modal seeds a module it opens. */
  const isPermissionEnabled = useCallback(
    (permissionId: string): boolean => {
      if (inheritedPermissions?.has(permissionId)) return true;
      const mod = PERMISSION_MODULES.find((m) =>
        m.permissions.some((p) => p.id === permissionId)
      );
      if (!mod) return false;
      const moduleToggles = getModuleToggles(mod.id);
      if (moduleToggles) return moduleToggles[permissionId] === true;
      return (
        mod.permissions.find((p) => p.id === permissionId)?.defaultEnabled === true
      );
    },
    [getModuleToggles, inheritedPermissions]
  );

  /* Commit linked-permission cascades that land outside the module they were
   * toggled in (data/linked-permissions.ts): merge each update into its home
   * module's toggle map and report every touched module to the parent, exactly
   * as a per-module save would. Modules without an override yet get a base from
   * the caller's initial toggles, falling back to catalog defaults. */
  const applyLinkedToggles = useCallback(
    (updates: Record<string, boolean>) => {
      const byModule: Record<string, Record<string, boolean>> = {};
      Object.entries(updates).forEach(([permissionId, val]) => {
        const mod = PERMISSION_MODULES.find((m) =>
          m.permissions.some((p) => p.id === permissionId)
        );
        if (!mod) return;
        (byModule[mod.id] ??= {})[permissionId] = val;
      });
      if (Object.keys(byModule).length === 0) return;

      const nextByModule: Record<string, Record<string, boolean>> = {};
      Object.entries(byModule).forEach(([modId, changes]) => {
        const base =
          moduleToggleOverrides[modId] ??
          getInitialToggles?.(modId) ??
          buildDefaultTogglesForModule(modId);
        nextByModule[modId] = { ...base, ...changes };
      });
      setModuleToggleOverrides((prev) => ({ ...prev, ...nextByModule }));
      Object.entries(nextByModule).forEach(([modId, t]) => onModuleTogglesChange?.(modId, t));
    },
    [moduleToggleOverrides, getInitialToggles, onModuleTogglesChange]
  );

  const handleEnableAll = useCallback((moduleId: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    const next: Record<string, boolean> = {};
    mod.permissions.forEach((p) => { next[p.id] = true; });
    setModuleToggleOverrides((prev) => ({ ...prev, [moduleId]: next }));
    onModuleTogglesChange?.(moduleId, next);
    // Linked groups stay in lockstep: counterparts in other modules follow.
    applyLinkedToggles(getCrossModuleLinkedUpdates(next, moduleId));
    toast.success(`All permissions enabled for ${mod.name}`);
  }, [onModuleTogglesChange, applyLinkedToggles]);

  const handleDisableAll = useCallback((moduleId: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    const next: Record<string, boolean> = {};
    mod.permissions.forEach((p) => { next[p.id] = false; });
    setModuleToggleOverrides((prev) => ({ ...prev, [moduleId]: next }));
    onModuleTogglesChange?.(moduleId, next);
    applyLinkedToggles(getCrossModuleLinkedUpdates(next, moduleId));
    toast.success(`All permissions disabled for ${mod.name}`);
  }, [onModuleTogglesChange, applyLinkedToggles]);

  /* ─── Threshold integration (role context only) ─── */
  const getModuleThresholds = useCallback(
    (moduleId: string): RoleThresholdEntry[] => {
      if (roleId == null) return [];
      return getRoleThresholdsForModule(roleId, moduleId);
    },
    [roleId]
  );

  const handleThresholdItemClick = useCallback((threshold: RoleThresholdEntry) => {
    // Open the existing ThresholdManagementModal scoped to this single threshold
    setThresholdModalEntries([
      {
        permissionId: threshold.permissionId,
        permissionName: threshold.permissionName,
        moduleName: threshold.moduleName,
        thresholdConfig: threshold.thresholdConfig,
        currentValue: threshold.currentValue,
      },
    ]);
  }, []);

  return (
    <>
      <ModuleGridShell
        variant="permissions"
        rows={rows}
        groups={PERMISSION_GROUPS}
        onModuleClick={handleModuleClick}
        onEnableAll={handleEnableAll}
        onDisableAll={handleDisableAll}
        getModuleThresholds={roleId != null ? getModuleThresholds : undefined}
        onThresholdItemClick={thresholdsReadOnly ? undefined : handleThresholdItemClick}
        renderCardView={() => null}
        cardGridClassName={(size) =>
          size === "large"
            ? "grid gap-4 grid-cols-1 @[900px]:grid-cols-2 @[1400px]:grid-cols-3"
            : size === "small"
              ? "grid gap-3 grid-cols-2 @[640px]:grid-cols-3 @[1024px]:grid-cols-5 @[1400px]:grid-cols-6"
              : "grid gap-4 grid-cols-1 @[640px]:grid-cols-2 @[1024px]:grid-cols-3 @[1400px]:grid-cols-4"
        }
        hideFilters={hideFilters}
        hideDensity={hideDensity}
        hideColumnSelector={hideColumnSelector}
        leadingToolbarSlot={leadingToolbarSlot}
        cardContainerClassName={cardContainerClassName}
        showMeMode={showMeMode}
        meModePredicate={meModePredicate}
        meModeTooltip={meModeTooltip}
        persistKey={persistKey}
        flush={flush}
        hidePagination={hidePagination}
        headerBanner={headerBanner}
        showToggleAllActions={showToggleAllActions}
      />

      {openModule && (
        <PermissionDetailModal
          /* Keyed by module so a cross-module jump remounts with that module's
             toggles and its landing permission instead of reusing stale state. */
          key={openModule.id}
          module={openModule}
          onClose={() => setOpenModule(null)}
          context={modalContext}
          mode={modalMode}
          userId={userId}
          initialToggles={getModuleToggles(openModule.id)}
          inheritedPermissions={inheritedPermissions}
          inheritedSources={inheritedSources}
          hideSourceChips={hideSourceChips}
          initialActivePermissionId={pendingActivePermId}
          isPermissionEnabled={isPermissionEnabled}
          onNavigateToModulePermission={handleNavigateToModulePermission}
          onApplyLinkedToggles={applyLinkedToggles}
          onSave={(savedToggles) => {
            const commit = () => {
              setModuleToggleOverrides((prev) => ({
                ...prev,
                [openModule.id]: savedToggles,
              }));
              onModuleTogglesChange?.(openModule.id, savedToggles);
            };
            if (onModuleSaveIntercept?.(openModule.id, savedToggles, commit)) {
              // Caller (e.g. RolePermissionsTab) will commit once any
              // tier-raise warnings have been resolved.
              return;
            }
            commit();
          }}
        />
      )}

      {thresholdModalEntries && (
        <ThresholdManagementModal
          open
          onClose={() => setThresholdModalEntries(null)}
          roleName={roleName ?? ""}
          thresholds={thresholdModalEntries}
          onSave={() => {
            toast.success("Threshold updated");
            setThresholdModalEntries(null);
          }}
        />
      )}
    </>
  );
}
