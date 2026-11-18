/**
 * Permission/module detail for role templates.
 *
 * This file holds no permission data of its own. Every module, permission
 * name, description, and license requirement is read straight out of the
 * catalog that the rest of the app runs on:
 *
 *   PERMISSION_MODULES        → the real modules and their permissions
 *   permissionRequiresFullAccess / computeRoleTier → the license classifier
 *
 * The input is the template's own resolved permission-id list (see
 * create-role/role-templates.tsx), so the summary a template shows and the
 * toggles the wizard turns on in Step 2 are the same list read two ways: the
 * preview can never promise a permission the template does not check.
 *
 * Consumed by TemplateCard (headline stats) and TemplateSummaryModal (the
 * full module-by-module breakdown).
 */

import type { LucideIcon } from "lucide-react";
import { PERMISSION_MODULES } from "./permissions-data";
import { computeRoleTier, permissionRequiresFullAccess } from "../lib/permission-tier";
import { countDistinctPermissions } from "./linked-permissions";

export interface TemplatePermission {
  id: string;
  name: string;
  description: string;
  /** True when this permission on its own forces the role to a Full Access license. */
  requiresFullAccess: boolean;
}

export interface TemplateModule {
  id: string;
  name: string;
  icon: LucideIcon;
  permissions: TemplatePermission[];
}

export interface RoleTemplateDetail {
  /** The permission ids this detail was expanded from. */
  permissionIds: string[];
  /** Only modules the set actually touches, in catalog order. */
  modules: TemplateModule[];
}

/**
 * Expand a template's permission set into the modules and permissions it
 * covers. Modules and permissions keep their catalog order, and a module the
 * set does not touch is left out entirely.
 */
export function getTemplateDetail(
  permissionIds: string[] | undefined
): RoleTemplateDetail | undefined {
  if (!permissionIds) return undefined;

  const granted = new Set(permissionIds);
  const modules: TemplateModule[] = [];

  for (const mod of PERMISSION_MODULES) {
    const permissions = mod.permissions
      .filter((p) => granted.has(p.id))
      .map<TemplatePermission>((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        requiresFullAccess: permissionRequiresFullAccess(p),
      }));
    if (permissions.length > 0) {
      modules.push({
        id: mod.id,
        name: mod.name,
        icon: mod.icon,
        permissions,
      });
    }
  }

  return { permissionIds, modules };
}

export interface TemplateStats {
  /** Distinct permissions: a linked permission listed under two modules counts
   *  once (ERP-5531 AC3, ERP-5500 AC23). The module list keeps both entries. */
  totalPermissions: number;
  moduleCount: number;
  /** Permissions that individually require a Full Access seat. */
  fullAccessCount: number;
  /** Permissions a Field User seat can hold. */
  fieldUserCount: number;
  /** The seat the whole bundle requires. One Full Access permission is enough. */
  requiredLicense: "Full Access" | "Field User";
}

export function getTemplateStats(detail: RoleTemplateDetail): TemplateStats {
  const all = detail.modules.flatMap((m) => m.permissions);
  const totalPermissions = countDistinctPermissions(all.map((p) => p.id));
  const fullAccessCount = countDistinctPermissions(
    all.filter((p) => p.requiresFullAccess).map((p) => p.id)
  );
  return {
    totalPermissions,
    moduleCount: detail.modules.length,
    fullAccessCount,
    fieldUserCount: totalPermissions - fullAccessCount,
    requiredLicense: templateLicense(detail.permissionIds),
  };
}

/**
 * The license a template's permission set requires, computed with the same
 * function the Create Role wizard uses on its live toggles. Deriving it here
 * rather than reading the template's own group label is what keeps this figure
 * honest: the label is display grouping, this is the seat the created role will
 * actually need.
 */
export function templateLicense(
  permissionIds: string[]
): "Full Access" | "Field User" {
  const toggles: Record<string, boolean> = {};
  for (const id of permissionIds) toggles[id] = true;
  return computeRoleTier(toggles);
}
