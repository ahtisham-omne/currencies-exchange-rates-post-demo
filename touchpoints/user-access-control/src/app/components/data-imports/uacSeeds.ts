/* Seeded history for User Access Control's two import surfaces, Users and
 * Roles. Each surface gets the two clean past imports every module has, plus
 * a June import whose failed rows between them trip every rule the surface's
 * validator runs, so the record page shows each error and warning a real
 * import can produce.
 *
 * The failures are not stored flags: the record pages re-run the validators
 * (import-review/validation.ts, import-review/rolesValidation.ts) against the
 * live listing context, so every issue below is reproduced by the same rule a
 * real upload would hit. src/test/seeded-failures-uac.test.ts holds that to
 * the code unions and the branch list.
 *
 * Users_June_2026.csv (9 imported, 6 failed)
 *   Row  Outcome   Rule
 *   1    Created   clean create, known role
 *   2    Created   clean create, two known roles
 *   3    Created   update: email matches an existing user, names left blank
 *   4    Created   MISSING_LICENSE (warning) license left blank on a create
 *   5    Created   INVALID_DROPDOWN (warning) license "Admin"
 *   6    Created   ROLE_NOT_FOUND (warning) one unknown role
 *   7    Created   ROLE_NOT_FOUND (warning) two unknown roles, plus
 *                  INVALID_PHONE (warning) mobile with more than 15 digits
 *   8    Created   ROLE_NOT_FOUND (warning) three unknown roles ("and 1 more"),
 *                  plus INVALID_PHONE (warning) mobile with letters
 *   9    Created   INVALID_PHONE (warning) work phone with too few digits
 *   10   Failed    REQUIRED_EMPTY (error) email left blank
 *   11   Failed    INVALID_EMAIL (error) email without a domain suffix
 *   12   Failed    DUPLICATE_EMAIL (error) same email as row 13
 *   13   Skipped   DUPLICATE_EMAIL (error) same email as row 12, skipped in review
 *   14   Failed    REQUIRED_EMPTY (error) first name blank on a create
 *   15   Failed    REQUIRED_EMPTY (error) last name blank on a create
 *
 * Roles_June_2026.csv (7 imported, 4 failed)
 *   Row  Outcome   Rule
 *   1    Created   clean create, owner by email, two known users
 *   2    Created   clean create, owner by full name
 *   3    Created   update: name matches the existing custom role
 *   4    Created   OWNER_NOT_FOUND (warning) owner email not in Omne
 *   5    Created   USER_NOT_FOUND (warning) one unknown user
 *   6    Created   USER_NOT_FOUND (warning) two unknown users, plus
 *                  OWNER_NOT_FOUND (warning) owner full name not in Omne
 *   7    Created   USER_NOT_FOUND (warning) three unknown users ("and 1 more")
 *   8    Failed    REQUIRED_EMPTY (error) role name left blank
 *   9    Failed    DUPLICATE_ROLE_NAME (error) same name as row 10
 *   10   Skipped   DUPLICATE_ROLE_NAME (error) same name as row 9, skipped in review
 *   11   Failed    SYSTEM_ROLE (error) name of a predefined system role
 */

import type { CompletedImportEntry } from "./importHistory";
import type { ImportedUserRow, RowOutcome } from "./importRecords";
import type { ImportedRoleRow } from "./rolesImportRecords";
import { validateRows } from "./import-review/validation";
import { validateRoleRows } from "./import-review/rolesValidation";
import type { UserReviewRow } from "./import-review/usersReviewMockData";
import type { RoleReviewRow } from "./import-review/rolesReviewData";
import { SYSTEM_ROLE_NAMES } from "../../data/roles-data";

export interface UsersSeed {
  entry: CompletedImportEntry;
  records: ImportedUserRow[];
}

export interface RolesSeed {
  entry: CompletedImportEntry;
  records: ImportedRoleRow[];
}

/* ─── Users ─── */

type UserInput = Partial<Omit<ImportedUserRow, "_row" | "_outcome" | "_message">> & { _outcome?: RowOutcome };

function userRow(row: number, input: UserInput): ImportedUserRow {
  return {
    firstName: "",
    lastName: "",
    emailAddress: "",
    licenseType: "",
    employeeStatus: "",
    assignedRoles: "",
    username: "",
    gender: "",
    dateOfBirth: "",
    preferredName: "",
    pronouns: "",
    jobTitle: "",
    personalEmail: "",
    mobile: "",
    workPhone: "",
    homeAddress: "",
    workAddress: "",
    ...input,
    _row: row,
    _outcome: input._outcome ?? "Created",
  };
}

const USERS_JUNE_INPUT: UserInput[] = [
  { firstName: "Priya", lastName: "Raman", emailAddress: "priya.raman@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", assignedRoles: "Warehouse Supervisor", username: "praman", jobTitle: "Warehouse Supervisor", mobile: "+1 (415) 555-0142", workAddress: "1200 Harbor Blvd, Oakland, CA" },
  { firstName: "Marcus", lastName: "Bell", emailAddress: "marcus.bell@omnesoft.com", licenseType: "Field User", employeeStatus: "Active", assignedRoles: "Receiving Clerk | Material Handler", username: "mbell", jobTitle: "Receiving Associate", workPhone: "415-555-0177 ext 12" },
  { emailAddress: "aahmad@omnesoft.com", jobTitle: "Director of Operations", workPhone: "+1 415 555 0101" },
  { firstName: "Hannah", lastName: "Okafor", emailAddress: "hannah.okafor@omnesoft.com", licenseType: "", employeeStatus: "Active", username: "hokafor", jobTitle: "Inventory Analyst" },
  { firstName: "Diego", lastName: "Alvarez", emailAddress: "diego.alvarez@omnesoft.com", licenseType: "Admin", employeeStatus: "Active", assignedRoles: "Buyer", username: "dalvarez", jobTitle: "Purchasing Agent" },
  { firstName: "Sofia", lastName: "Lindqvist", emailAddress: "sofia.lindqvist@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", assignedRoles: "Night Shift Lead", username: "slindqvist", jobTitle: "Shift Lead" },
  { firstName: "Tomas", lastName: "Novak", emailAddress: "tomas.novak@omnesoft.com", licenseType: "Field User", employeeStatus: "Active", assignedRoles: "Dispatch Clerk | Yard Marshal | Dock Captain", username: "tnovak", mobile: "+44 20 7946 0958 1234 5678", jobTitle: "Dispatcher" },
  { firstName: "Aisha", lastName: "Karim", emailAddress: "aisha.karim@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", assignedRoles: "Returns Lead | Kitting Lead | Quality Lead", username: "akarim", mobile: "call reception", jobTitle: "Operations Coordinator" },
  { firstName: "Ben", lastName: "Carter", emailAddress: "ben.carter@omnesoft.com", licenseType: "No License", employeeStatus: "Inactive", username: "bcarter", workPhone: "555-12", jobTitle: "Seasonal Associate" },
  { firstName: "Grace", lastName: "Liu", emailAddress: "", licenseType: "Full Access", employeeStatus: "Active", username: "gliu", jobTitle: "Controller", _outcome: "Failed" },
  { firstName: "Omar", lastName: "Haddad", emailAddress: "omar.haddad@omnesoft", licenseType: "Field User", employeeStatus: "Active", username: "ohaddad", jobTitle: "Driver", _outcome: "Failed" },
  { firstName: "Lena", lastName: "Fischer", emailAddress: "lena.fischer@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", username: "lfischer", jobTitle: "Account Manager", _outcome: "Failed" },
  { firstName: "Lena", lastName: "Fisher", emailAddress: "lena.fischer@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", username: "lfisher", jobTitle: "Account Manager", _outcome: "Skipped" },
  { firstName: "", lastName: "Petrov", emailAddress: "ivan.petrov@omnesoft.com", licenseType: "Field User", employeeStatus: "Active", username: "ipetrov", jobTitle: "Technician", _outcome: "Failed" },
  { firstName: "Mei", lastName: "", emailAddress: "mei.tanaka@omnesoft.com", licenseType: "Full Access", employeeStatus: "Active", username: "mtanaka", jobTitle: "Planner", _outcome: "Failed" },
];

function toUserReviewRow(r: ImportedUserRow): UserReviewRow {
  const { _row, _outcome, _message, employeeStatus, ...rest } = r;
  void _row; void _outcome; void _message;
  return { ...rest, status: employeeStatus };
}

/** Failed and skipped rows carry the message the review step would have shown,
 *  the fallback the record page reads when live validation has nothing. */
function withUserMessages(rows: ImportedUserRow[]): ImportedUserRow[] {
  const result = validateRows(rows.map(toUserReviewRow));
  return rows.map((r, i) => {
    if (r._outcome === "Created") return r;
    const message = result.rows[i].issues.filter((x) => x.severity === "error").map((x) => x.message).join(" ");
    return { ...r, _message: message };
  });
}

export function buildUsersJuneSeed(): UsersSeed {
  const records = withUserMessages(USERS_JUNE_INPUT.map((input, i) => userRow(i + 1, input)));
  const imported = records.filter((r) => r._outcome === "Created").length;
  return {
    entry: {
      id: "imp-users-3",
      moduleSlug: "users",
      name: "Users June update",
      fileName: "Users_June_2026.csv",
      description: "Monthly users update",
      dateISO: "2026-07-20T10:40:00.000Z",
      importerKey: "ra",
      recordCount: records.length,
      importedCount: imported,
      failedCount: records.length - imported,
    },
    records,
  };
}

/* ─── Roles ─── */

type RoleInput = Partial<Omit<ImportedRoleRow, "_row" | "_outcome" | "_message">> & { _outcome?: RowOutcome };

function roleRow(row: number, input: RoleInput): ImportedRoleRow {
  return {
    roleName: "",
    description: "",
    roleOwner: "",
    assignedUsers: "",
    ...input,
    _row: row,
    _outcome: input._outcome ?? "Created",
  };
}

const ROLES_JULY_INPUT: RoleInput[] = [
  { roleName: "Returns Coordinator", description: "Receives customer returns, inspects them and books them back into stock.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "shrapnull@yahoo.ca | erosenbloom@omnesoft.com" },
  { roleName: "Quality Inspector", description: "Signs off inbound lots against the quality checklist.", roleOwner: "Faizan Khan", assignedUsers: "nanwer@omnesoft.com" },
  { roleName: "Kitting Lead", description: "Builds kits and bundles from component stock.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "shrapnul@live.com" },
  { roleName: "Yard Coordinator", description: "Schedules dock doors and trailer moves in the yard.", roleOwner: "faizan.khan@omne.com", assignedUsers: "vlefevre@gmail.com | wildixon@aol.com" },
  { roleName: "Customer Service Agent", description: "Answers order status questions and logs customer issues.", roleOwner: "Areeb Tanveer", assignedUsers: "valdez@comcast.net" },
  { roleName: "Pricing Analyst", description: "Maintains price lists and reviews margin exceptions.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "sjava@mac.com" },
  { roleName: "Credit Reviewer", description: "Reviews credit holds before orders release.", roleOwner: "Eli Rosenbloom", assignedUsers: "" },
  { roleName: "Maintenance Planner", description: "Plans preventive maintenance on warehouse equipment.", roleOwner: "erosenbloom@omnesoft.com", assignedUsers: "shrapnull@yahoo.ca" },
  { roleName: "Safety Officer", description: "Runs site safety walks and records incidents.", roleOwner: "Nophil Anwer", assignedUsers: "nanwer@omnesoft.com | shrapnul@live.com" },
  { roleName: "Transport Planner", description: "Books carriers and plans outbound routes.", roleOwner: "faizan.khan@omne.com", assignedUsers: "wildixon@aol.com" },
  { roleName: "Inventory Auditor", description: "Audits stock records against cycle count results.", roleOwner: "Irtaza Abid", assignedUsers: "vlefevre@gmail.com" },
  { roleName: "Purchasing Assistant", description: "Raises purchase requisitions for approval.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "valdez@comcast.net" },
];

const ROLES_INITIAL_INPUT: RoleInput[] = [
  { roleName: "Compliance Auditor", description: "Reviews access, audit trails and policy exceptions.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "erosenbloom@omnesoft.com" },
  { roleName: "Sales Operations Analyst", description: "Owns sales reporting and order desk processes.", roleOwner: "Faizan Khan", assignedUsers: "sjava@mac.com" },
  { roleName: "Senior Buyer", description: "Negotiates supplier terms for strategic categories.", roleOwner: "faizan.khan@omne.com", assignedUsers: "wildixon@aol.com" },
  { roleName: "Warehouse Operator", description: "Picks, packs and moves stock on the warehouse floor.", roleOwner: "Areeb Tanveer", assignedUsers: "shrapnull@yahoo.ca | shrapnul@live.com" },
  { roleName: "Returns Clerk", description: "Processes returned goods at the returns bench.", roleOwner: "Eli Rosenbloom", assignedUsers: "nanwer@omnesoft.com" },
  { roleName: "Label Printer Operator", description: "Prints shipping and product labels.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "" },
  { roleName: "Production Scheduler", description: "Sequences work orders across the production lines.", roleOwner: "Irtaza Abid", assignedUsers: "vlefevre@gmail.com" },
  { roleName: "Import Coordinator", description: "Tracks inbound containers through customs.", roleOwner: "erosenbloom@omnesoft.com", assignedUsers: "valdez@comcast.net" },
];

const ROLES_JUNE_INPUT: RoleInput[] = [
  { roleName: "Returns Supervisor", description: "Approves return authorisations and credit notes.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "shrapnull@yahoo.ca | erosenbloom@omnesoft.com" },
  { roleName: "Quality Manager", description: "Owns the quality programme and supplier corrective actions.", roleOwner: "Faizan Khan", assignedUsers: "" },
  { roleName: "Compliance Auditor", description: "Reviews access, audit trails, policy exceptions and SOX evidence.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "" },
  { roleName: "Freight Auditor", description: "Checks carrier invoices against booked rates.", roleOwner: "jordan.miles@omnesoft.com", assignedUsers: "wildixon@aol.com" },
  { roleName: "Inventory Planner", description: "Sets reorder points and safety stock.", roleOwner: "faizan.khan@omne.com", assignedUsers: "vlefevre@gmail.com | pat.nguyen@omnesoft.com" },
  { roleName: "Customer Success Lead", description: "Leads onboarding for new key accounts.", roleOwner: "Jordan Miles", assignedUsers: "chris.doyle@omnesoft.com | nina.patel@omnesoft.com" },
  { roleName: "Treasury Analyst", description: "Forecasts cash and reconciles bank accounts.", roleOwner: "Areeb Tanveer", assignedUsers: "sjava@mac.com | sam.ortiz@omnesoft.com | kim.lee@omnesoft.com | ravi.das@omnesoft.com" },
  { roleName: "", description: "Covers weekend receiving shifts.", roleOwner: "aahmad@omnesoft.com", assignedUsers: "nanwer@omnesoft.com", _outcome: "Failed" },
  { roleName: "Site Safety Officer", description: "Runs site safety walks and records incidents.", roleOwner: "Nophil Anwer", assignedUsers: "shrapnul@live.com", _outcome: "Failed" },
  { roleName: "Site Safety Officer", description: "Site safety walks, second site.", roleOwner: "Nophil Anwer", assignedUsers: "valdez@comcast.net", _outcome: "Skipped" },
  { roleName: "Buyer", description: "Buys stock items from approved suppliers.", roleOwner: "faizan.khan@omne.com", assignedUsers: "erosenbloom@omnesoft.com", _outcome: "Failed" },
];

function toRoleReviewRow(r: ImportedRoleRow): RoleReviewRow {
  return { roleName: r.roleName, description: r.description, roleOwner: r.roleOwner, assignedUsers: r.assignedUsers };
}

/** Error messages need the system role names, the one error rule that reads context. */
const SYSTEM_ROLE_NAMES_LOWER = new Set(SYSTEM_ROLE_NAMES.map((n) => n.trim().toLowerCase()));

function withRoleMessages(rows: ImportedRoleRow[]): ImportedRoleRow[] {
  const result = validateRoleRows(rows.map(toRoleReviewRow), { systemRoleNames: SYSTEM_ROLE_NAMES_LOWER });
  return rows.map((r, i) => {
    if (r._outcome === "Created") return r;
    const message = result.rows[i].issues.filter((x) => x.severity === "error").map((x) => x.message).join(" ");
    return { ...r, _message: message };
  });
}

function rolesSeed(
  id: string,
  meta: Pick<CompletedImportEntry, "name" | "fileName" | "description" | "dateISO" | "importerKey">,
  input: RoleInput[],
): RolesSeed {
  const records = withRoleMessages(input.map((r, i) => roleRow(i + 1, r)));
  const imported = records.filter((r) => r._outcome === "Created").length;
  return {
    entry: {
      id,
      moduleSlug: "roles",
      ...meta,
      recordCount: records.length,
      importedCount: imported,
      failedCount: records.length - imported,
    },
    records,
  };
}

/** The Roles surface's three seeds, newest last. Ids match the generic mocks
 *  (imp-roles-1, imp-roles-2) so links into them keep working. */
export function buildRolesSeeds(): RolesSeed[] {
  return [
    rolesSeed("imp-roles-1", {
      name: "Roles July update",
      fileName: "Roles_July_2026.csv",
      description: "Monthly roles update",
      dateISO: "2026-07-12T09:24:00.000Z",
      importerKey: "sj",
    }, ROLES_JULY_INPUT),
    rolesSeed("imp-roles-2", {
      name: "Roles initial load",
      fileName: "Roles_Initial_2026.csv",
      description: "Initial roles data load",
      dateISO: "2026-06-28T14:05:00.000Z",
      importerKey: "ac",
    }, ROLES_INITIAL_INPUT),
    rolesSeed("imp-roles-3", {
      name: "Roles June update",
      fileName: "Roles_June_2026.csv",
      description:
        "June roles update agreed in the Q2 access review with the operations and finance leads. Adds returns, quality, compliance, freight and treasury roles for the second distribution site, gives each a named owner and its first users, and aligns the Buyer role with the approved supplier policy. Rows with a missing role name or a duplicate Site Safety Officer were rejected and need fixing before re-import.",
      dateISO: "2026-07-20T10:40:00.000Z",
      importerKey: "ra",
    }, ROLES_JUNE_INPUT),
  ];
}
