/* ────────────────────────────────────────────────────────────
   Column layout for the Import Review page (Roles template).
   Mirrors usersReviewMockData.ts one-to-one, same shape, same
   column-descriptor contract, with the fields swapped for the
   Roles import template's 5 columns.
   ──────────────────────────────────────────────────────────── */

export interface RoleReviewRow {
  roleName: string;
  description: string;
  roleOwner: string;
  assignedUsers: string;
}

export type RoleReviewField = keyof RoleReviewRow;

export interface RoleReviewColumn {
  key: RoleReviewField;
  label: string;
  defaultWidth: number;
  /** Short field reference shown in the column-header tooltip. */
  description: string;
}

/* Order matches the Roles import template */
export const ROLE_REVIEW_COLUMNS: RoleReviewColumn[] = [
  { key: "roleName",      label: "Role Name",      defaultWidth: 200, description: "Unique role name. Required: it's how Omne matches new rows to existing roles." },
  { key: "description",   label: "Description",    defaultWidth: 260, description: "What this role is for and what it can do." },
  { key: "roleOwner",     label: "Role Owner",     defaultWidth: 200, description: "Email or full name of an existing Omne user responsible for this role." },
  { key: "assignedUsers", label: "Assigned Users", defaultWidth: 240, description: "Pipe-separated list of user emails. Users must already exist in Omne." },
];
