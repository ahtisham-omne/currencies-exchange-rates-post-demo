import { useMemo } from "react";
import { ImportWizardModal } from "./ImportWizardModal";
import type { CorrectionSetupContext } from "./ImportSetupStep";
import type { UserReviewRow } from "../import-review/usersReviewMockData";
import type { UserRow, LicenseType, UserStatus } from "../../../data/users-data";
import {
  makeImportedUserId,
  setImportNotice,
  upsertImportedUsers,
  getCurrentUserEmails,
  getCurrentRoleNames,
  type ImportUserUpdate,
} from "../../../data/users-row-store";
import { CURRENT_USER } from "../../../data/current-user";

const VALID_LICENSES: ReadonlySet<LicenseType> = new Set(["Full Access", "Field User", "No License"]);

/* Status column: the file (and the review grid) speaks the product's
 * vocabulary, "Active" / "Deactivated", which is what
 * OMNE_Users_Import_Guide.txt documents. The listing stores the deactivated
 * state as `Inactive`, so map on the way in. "Inactive" is still accepted so
 * a file written against the older wording keeps importing. Matching is
 * case-insensitive and anything unrecognised falls back to Active, as before. */
const STATUS_ALIASES: Record<string, UserStatus> = {
  active: "Active",
  deactivated: "Inactive",
  inactive: "Inactive",
};

export function normalizeImportStatus(raw: string): UserStatus | null {
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function formatMMDDYYYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Convert an Import Review row into the Users listing row shape. The
 *  caller assigns a real id only for created rows; updates leave the id
 *  as 0 since the upsert path looks the user up by email instead. */
export function reviewRowToUserRow(r: UserReviewRow, id: number): UserRow {
  const fullName = `${r.firstName} ${r.lastName}`.trim();
  const roles = r.assignedRoles
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const license: LicenseType = VALID_LICENSES.has(r.licenseType as LicenseType)
    ? (r.licenseType as LicenseType)
    : "No License";
  const status: UserStatus = normalizeImportStatus(r.status) ?? "Active";
  return {
    id,
    fullName,
    assignedRoles: roles,
    license,
    email: r.emailAddress,
    phone: r.mobile || "",
    lastLogon: "Never",
    status,
    /* Whoever is signed in: the sample's admin, or the person from Home. */
    invitedBy: CURRENT_USER.name,
    invitedOn: formatMMDDYYYY(new Date()),
    inviteAcceptedOn: "",
  };
}

/** Convert an update row (email matched an existing user) into a field-level
 *  patch. Only non-blank fields make it into the patch, so blank cells in
 *  the file leave the existing user's values untouched, an existing value
 *  is never overwritten with a blank. Email is carried as the matching key
 *  only and is never applied to the user. */
export function reviewRowToUserUpdate(r: UserReviewRow): ImportUserUpdate {
  const patch: ImportUserUpdate = { email: r.emailAddress.trim() };
  const firstName = r.firstName.trim();
  if (firstName) patch.firstName = firstName;
  const lastName = r.lastName.trim();
  if (lastName) patch.lastName = lastName;
  const license = r.licenseType.trim();
  if (license && VALID_LICENSES.has(license as LicenseType)) {
    patch.license = license as LicenseType;
  }
  const status = normalizeImportStatus(r.status);
  if (status) patch.status = status;
  const roles = r.assignedRoles
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  if (roles.length > 0) patch.assignedRoles = roles;
  const phone = r.mobile.trim();
  if (phone) patch.phone = phone;
  return patch;
}

interface UsersImportWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called after the user completes the import via the review modal,
   *  the host page should refresh its listing if it renders import history. */
  onImportCompleted?: () => void;
  /** Optional header title / subtitle overrides, forwarded to the wizard.
   *  The re-import flow uses these to signal "upload your fixed file here". */
  title?: string;
  description?: string;
  /** The import this upload corrects, when it was launched from one. Lets a
   *  file whose provenance stamp was stripped still nest under its parent. */
  parentImportId?: string | null;
  /** Correction framing for the setup step. */
  correction?: CorrectionSetupContext | null;
  /** File dropped on the correction strip, accepted automatically. */
  initialFile?: File | null;
}

/** The Import Users modal. Single shared entry point used by both
 *  User Access Control > Users and Company Setup > Data Imports > Users, so
 *  the two surfaces run the exact same code: same setup-step layout, same
 *  validation context, and the same post-import fold of created/updated rows
 *  into the users listing. */
export function UsersImportWizard({
  open,
  onClose,
  onImportCompleted,
  title,
  description,
  parentImportId = null,
  correction = null,
  initialFile = null,
}: UsersImportWizardProps) {
  /* Snapshot the existing-user emails + known role names whenever the import
   * wizard opens. Recomputed only on transition so the validation context
   * stays referentially stable while the wizard is on screen, and so the
   * second open in a re-upload sees rows from the first import. */
  const validationContext = useMemo(() => {
    if (!open) return undefined;
    return {
      existingEmails: getCurrentUserEmails(),
      knownRoles: getCurrentRoleNames(),
    };
  }, [open]);

  return (
    <ImportWizardModal
      open={open}
      onClose={onClose}
      recordTypeLabel="Users"
      moduleSlug="users"
      descriptionPlacement="bottom"
      title={title}
      description={description}
      parentImportId={parentImportId}
      correction={correction}
      initialFile={initialFile}
      validationContext={validationContext}
      onImportCompleted={onImportCompleted}
      onApplied={({ created, updated, skipped, warningCount, importId }) => {
        /* Creates become full listing rows with freshly minted ids; updates
         * become field-level patches matched to the existing user by email. */
        const createdRows = created.map((r) => reviewRowToUserRow(r, makeImportedUserId()));
        const updatePatches = updated.map(reviewRowToUserUpdate);
        const result = upsertImportedUsers(createdRows, updatePatches);
        setImportNotice({
          created: result.created,
          updated: result.updated,
          skipped: skipped.length,
          warnings: warningCount,
          importId,
        });
      }}
    />
  );
}
