/**
 * Types and constants for the Create Role wizard.
 */

export interface CreateRoleFormData {
  /* ── Identity ── */
  roleName: string;
  description: string;

  /* ── Access Configuration ── */
  licenseType: "Full Access" | "Field User" | "";
  status: "Active" | "Disabled" | "Draft";

  /* ── User Assignment (Step 3) ── */
  assignedUsers: number[];
}

export const EMPTY_ROLE_FORM: CreateRoleFormData = {
  roleName: "",
  description: "",
  licenseType: "",
  status: "Draft",
  assignedUsers: [],
};
