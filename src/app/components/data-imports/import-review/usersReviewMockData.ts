/* ────────────────────────────────────────────────────────────
   Mock data for the Import Review page (Users template)
   40 rows × 18 fields. Intentionally seeded with a few rows
   that will trigger errors / warnings once validation is wired
   up in a later prompt (empty First Name, bad email, invalid
   License Type, duplicate email).
   ──────────────────────────────────────────────────────────── */

export interface UserReviewRow {
  firstName: string;
  lastName: string;
  emailAddress: string;
  licenseType: string;
  status: string;
  assignedRoles: string;
  username: string;
  gender: string;
  dateOfBirth: string;
  preferredName: string;
  pronouns: string;
  jobTitle: string;
  personalEmail: string;
  mobile: string;
  workPhone: string;
  homeAddress: string;
  workAddress: string;
}

export type UserReviewField = keyof UserReviewRow;

export interface UserReviewColumn {
  key: UserReviewField;
  label: string;
  defaultWidth: number;
  /** Short field reference shown in the column-header tooltip. */
  description: string;
}

/* Order matches the Users import template */
export const USER_REVIEW_COLUMNS: UserReviewColumn[] = [
  { key: "firstName",        label: "First Name",         defaultWidth: 140, description: "User's given name. Required." },
  { key: "lastName",         label: "Last Name",          defaultWidth: 140, description: "User's family name. Required." },
  { key: "emailAddress",     label: "Email Address",      defaultWidth: 220, description: "Unique email used for sign-in and notifications. Required." },
  { key: "licenseType",      label: "License Type",       defaultWidth: 130, description: "One of: Full Access, Field User, No License. Optional; blank imports a new user with No License and leaves an existing user's license unchanged." },
  { key: "status",           label: "Status",             defaultWidth: 90,  description: "Account state: Active or Deactivated. Optional; blank leaves an existing user unchanged and starts a new one as Draft." },
  { key: "assignedRoles",    label: "Assigned Roles",     defaultWidth: 220, description: "Pipe-separated list of role names. Roles must already exist in Omne." },
  { key: "username",         label: "Username",           defaultWidth: 140, description: "Optional short identifier; defaults to the email address if blank." },
  { key: "gender",           label: "Gender",             defaultWidth: 90,  description: "Self-reported gender." },
  { key: "dateOfBirth",      label: "Date of Birth",      defaultWidth: 130, description: "Format YYYY-MM-DD." },
  { key: "preferredName",    label: "Preferred Name",     defaultWidth: 140, description: "How the user prefers to be addressed." },
  { key: "pronouns",         label: "Pronouns",           defaultWidth: 90,  description: "Optional pronouns (e.g. she/her, he/him, they/them)." },
  { key: "jobTitle",         label: "Job Title",          defaultWidth: 140, description: "User's role title." },
  { key: "personalEmail",    label: "Personal Email",     defaultWidth: 200, description: "Optional personal email address, not used for sign-in." },
  { key: "mobile",           label: "Mobile",             defaultWidth: 150, description: "Mobile phone number with country code." },
  { key: "workPhone",        label: "Work Phone",         defaultWidth: 150, description: "Office or work-issued phone number." },
  { key: "homeAddress",      label: "Home Address",       defaultWidth: 220, description: "Full home address (street, city, state/region, postal code)." },
  { key: "workAddress",      label: "Work Address",       defaultWidth: 220, description: "Full work site address (street, city, state/region, postal code)." },
];
