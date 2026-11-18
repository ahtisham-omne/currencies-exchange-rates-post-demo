import type { RoleStatus } from "../../data/roles-data";

/** Fields that are editable on the Role Detail page. `status` carries the
 *  role's current lifecycle value (which may be the system-managed "Draft"
 *  for an imported, permission-less role); the edit UI only offers the
 *  Active / Inactive toggle. */
export interface RoleEditFormData {
  roleName: string;
  description: string;
  status: RoleStatus;
}
