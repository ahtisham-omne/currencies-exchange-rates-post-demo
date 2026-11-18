import { useCallback } from "react";
import { Info } from "lucide-react";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { PermissionsModuleGrid } from "../permissions/PermissionsModuleGrid";

/** Stable empty Set: a brand-new role has no inherited permissions, so every
 *  toggled permission renders the green "Direct" source chip. */
const EMPTY_INHERITED_SET: Set<string> = new Set();

/* Explains the pre-toggled baseline permissions so an admin does not read them
   as a bug. Same flush strip, colors, and type as the Draft notice on the roles
   import review step. */
const DEFAULTS_BANNER = (
  <div
    className="shrink-0 flex items-center gap-2.5 px-4 py-2.5"
    style={{
      backgroundColor: "#F5F9FF",
      borderBottom: "1px solid #DBEAFE",
      color: "#475569",
    }}
    role="status"
  >
    <Info className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} aria-hidden />
    <span className="flex-1 min-w-0 text-[12.5px] leading-snug" style={{ fontWeight: 500 }}>
      Some permissions are on by default so the role is usable right away. Turn
      them off if you don't need them.
    </span>
  </div>
);

// ─── Props ──────────────────────────────────────────────────────────────────

interface Step2Props {
  /** Master toggle state: permission id → enabled */
  permissionToggles: Record<string, boolean>;
  /** Called whenever toggles change (single, bulk, or grant/revoke all) */
  onPermissionTogglesChange: (toggles: Record<string, boolean>) => void;
  /** Show the "some permissions are on by default" strip. Only true where a
   *  baseline is actually pre-applied, i.e. authoring a brand-new role. Flows
   *  that seed from a role's own saved bundle (Unarchive) pass false: nothing
   *  is defaulted on there, so the notice would misdescribe what the admin is
   *  looking at. */
  showDefaultsBanner?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────
//
// The Create Role permissions step renders the exact same catalog component used
// on the Role detail → Permissions tab (PermissionsModuleGrid), so the wrapper,
// grouping, module cards, and per-module detail modal are identical everywhere.
// The wizard owns the toggle state; the grid seeds each module from it via
// `getInitialToggles` and reports every committed change back through
// `onModuleTogglesChange` (covers modal saves and Enable/Disable All).

export function Step2RolePermissions({
  permissionToggles,
  onPermissionTogglesChange,
  showDefaultsBanner = true,
}: Step2Props) {
  const getInitialToggles = useCallback(
    (moduleId: string): Record<string, boolean> => {
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      const toggles: Record<string, boolean> = {};
      mod?.permissions.forEach((p) => {
        toggles[p.id] = permissionToggles[p.id] ?? false;
      });
      return toggles;
    },
    [permissionToggles]
  );

  const handleModuleTogglesChange = useCallback(
    (_moduleId: string, moduleToggles: Record<string, boolean>) => {
      onPermissionTogglesChange({ ...permissionToggles, ...moduleToggles });
    },
    [permissionToggles, onPermissionTogglesChange]
  );

  return (
    <PermissionsModuleGrid
      modalContext="create-flow"
      modalMode="editable"
      getInitialToggles={getInitialToggles}
      onModuleTogglesChange={handleModuleTogglesChange}
      inheritedPermissions={EMPTY_INHERITED_SET}
      hideSourceChips
      headerBanner={showDefaultsBanner ? DEFAULTS_BANNER : undefined}
    />
  );
}
