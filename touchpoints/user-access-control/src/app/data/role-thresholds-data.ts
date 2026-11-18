import { PERMISSION_MODULES, type ThresholdConfig } from "./permissions-data";

/**
 * Per-role threshold values keyed by roleId.
 * Each entry: { permId, value }, value is a numeric string (or "" for "no limit"),
 * matched against PERMISSION_MODULES[*].permissions[*].thresholdConfig.
 */
export const ROLE_THRESHOLD_MAP: Record<number, { permId: string; value: string }[]> = {
  1: [
    { permId: "po-create", value: "100000" },
    { permId: "ur-assign-roles", value: "" },
    { permId: "pi-adjust", value: "100" },
  ],
  2: [
    { permId: "qt-discount", value: "25" },
    { permId: "po-create", value: "25000" },
  ],
  3: [
    { permId: "rcv-discrepancy", value: "10" },
    { permId: "pi-adjust", value: "50" },
  ],
  4: [
    { permId: "po-create", value: "50000" },
    { permId: "rcv-discrepancy", value: "15" },
    { permId: "pi-adjust", value: "100" },
  ],
  5: [
    { permId: "qt-discount", value: "10" },
  ],
  6: [
    { permId: "rcv-discrepancy", value: "20" },
    { permId: "qt-discount", value: "15" },
  ],
};

export interface RoleThresholdEntry {
  permissionId: string;
  permissionName: string;
  moduleId: string;
  moduleName: string;
  thresholdConfig: ThresholdConfig;
  currentValue: string;
  /** Pre-formatted display string e.g. "up to $50,000" or "up to 100 units" */
  displayValue: string;
}

function formatDisplayValue(value: string, config: ThresholdConfig): string {
  if (config.type === "descriptive") return config.label;
  if (!value) return "No limit";
  const num = Number(value.replace(/,/g, ""));
  if (isNaN(num)) return value;
  const formatted = num.toLocaleString("en-US");
  const unitText =
    config.unitPosition === "prefix"
      ? `${config.unit}${formatted}`
      : `${formatted} ${config.unit}`.trim();
  return `up to ${unitText}`;
}

/** Get all threshold entries for a given role, hydrated with permission/module info. */
export function getRoleThresholds(roleId: number): RoleThresholdEntry[] {
  const mapped = ROLE_THRESHOLD_MAP[roleId] ?? [];
  const all = PERMISSION_MODULES.flatMap((m) =>
    m.permissions.map((p) => ({
      perm: p,
      moduleId: m.id,
      moduleName: m.name,
    }))
  );
  return mapped
    .map((entry) => {
      const found = all.find((x) => x.perm.id === entry.permId);
      if (!found || !found.perm.thresholdConfig) return null;
      const cfg = found.perm.thresholdConfig;
      return {
        permissionId: found.perm.id,
        permissionName: found.perm.name,
        moduleId: found.moduleId,
        moduleName: found.moduleName,
        thresholdConfig: cfg,
        currentValue: entry.value,
        displayValue: formatDisplayValue(entry.value, cfg),
      } as RoleThresholdEntry;
    })
    .filter(Boolean) as RoleThresholdEntry[];
}

/** Get threshold entries for a specific module within a role. */
export function getRoleThresholdsForModule(
  roleId: number,
  moduleId: string
): RoleThresholdEntry[] {
  return getRoleThresholds(roleId).filter((t) => t.moduleId === moduleId);
}
