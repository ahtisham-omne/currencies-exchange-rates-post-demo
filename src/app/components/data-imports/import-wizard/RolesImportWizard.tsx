import { useMemo, useRef } from "react";
import { RolesImportWizardModal } from "./RolesImportWizardModal";
import type { CorrectionSetupContext } from "./ImportSetupStep";
import { openAssignPermissions } from "../../assign-permissions/assignPermissionsStore";
import type { RoleReviewRow } from "../import-review/rolesReviewData";
import type { RoleRow } from "../../../data/roles-data";
import { users } from "../../../data/users-data";
import {
  makeImportedRoleId,
  setRolesImportNotice,
  upsertImportedRoles,
  getExistingRoleNames,
  getSystemRoleNamesLower,
  type ImportRoleCreate,
  type ImportRoleUpdate,
} from "../../../data/roles-row-store";
import { getCurrentUserEmails } from "../../../data/users-row-store";
import { CURRENT_USER } from "../../../data/current-user";

/** Resolve a pipe-separated Assigned Users cell into the ids of users that
 *  actually exist in Omne. Unknown emails were already flagged as a warning
 *  during review, they simply don't resolve here, matching the warning's
 *  "the role will import without these users" promise. */
function resolveAssignedUserIds(assignedUsers: string): number[] {
  const declared = assignedUsers
    .split("|")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (declared.length === 0) return [];
  const ids: number[] = [];
  for (const email of declared) {
    const match = users.find((u) => u.email.trim().toLowerCase() === email);
    if (match) ids.push(match.id);
  }
  return ids;
}

/** Convert an Import Review row into the Roles listing row shape plus its
 *  resolved user assignments. The caller assigns a real id only for created
 *  rows; updates leave the id as 0 since the upsert path looks the role up
 *  by name instead. */
export function reviewRowToRoleCreate(r: RoleReviewRow, id: number): ImportRoleCreate {
  /* The template carries no license, status, or permissions. A freshly
   * imported role is an empty shell, so it lands as "Draft": it grants
   * nothing and can't be used until permissions are assigned in Omne, at
   * which point it graduates to Active and its license is derived from those
   * permissions. Until then it defaults to the base "Field User" tier. */
  const row: RoleRow = {
    id,
    roleName: r.roleName.trim(),
    description: r.description.trim(),
    usersCount: 0,
    licenseRequired: "Field User",
    status: "Draft",
    roleOwner: r.roleOwner.trim() || undefined,
    /* Whoever is signed in: the sample's admin, or the person from Home. */
    createdBy: CURRENT_USER.name,
  };
  return { row, assignedUserIds: resolveAssignedUserIds(r.assignedUsers) };
}

/** Convert an update row (name matched an existing role) into a field-level
 *  patch. Only non-blank fields make it into the patch, so blank cells in
 *  the file leave the existing role's values untouched, an existing value
 *  is never overwritten with a blank. Role name is carried as the matching
 *  key only and is never applied to the role. */
export function reviewRowToRoleUpdate(r: RoleReviewRow): ImportRoleUpdate {
  const patch: ImportRoleUpdate = { roleName: r.roleName.trim() };
  const description = r.description.trim();
  if (description) patch.description = description;
  const roleOwner = r.roleOwner.trim();
  if (roleOwner) patch.roleOwner = roleOwner;
  const assignedUserIds = resolveAssignedUserIds(r.assignedUsers);
  if (assignedUserIds.length > 0) patch.assignedUserIds = assignedUserIds;
  return patch;
}

interface RolesImportWizardProps {
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

/** The Import Roles modal. Single shared entry point used by both
 *  User Access Control > Roles and Company Setup > Data Imports > Roles, so
 *  the two surfaces run the exact same code: same setup-step layout, same
 *  validation context, and the same post-import fold of created/updated rows
 *  into the roles listing. Mirrors UsersImportWizard one-to-one. */
export function RolesImportWizard({
  open,
  onClose,
  onImportCompleted,
  title,
  description,
  parentImportId = null,
  correction = null,
  initialFile = null,
}: RolesImportWizardProps) {
  /* Snapshot the existing role names + system role names + user emails/names
   * whenever the import wizard opens. Recomputed only on transition so the
   * validation context stays referentially stable while the wizard is on
   * screen, and so the second open in a re-upload sees rows from the first
   * import. */
  const validationContext = useMemo(() => {
    if (!open) return undefined;
    const existingUserNames = new Set<string>();
    for (const u of users) {
      const name = u.fullName.trim().toLowerCase();
      if (name) existingUserNames.add(name);
    }
    return {
      existingRoleNames: getExistingRoleNames(),
      systemRoleNames: getSystemRoleNamesLower(),
      existingUserEmails: getCurrentUserEmails(),
      existingUserNames,
    };
  }, [open]);

  /* Ids of the roles created by the most recent import, captured when the
   * rows are folded into the listing so the completion screen's "Set up
   * permissions" CTA can open the guided flow scoped to exactly them. */
  const createdRoleIdsRef = useRef<number[]>([]);

  return (
    <RolesImportWizardModal
      open={open}
      onClose={onClose}
      recordTypeLabel="Roles"
      moduleSlug="roles"
      descriptionPlacement="bottom"
      title={title}
      description={description}
      parentImportId={parentImportId}
      correction={correction}
      initialFile={initialFile}
      validationContext={validationContext}
      onImportCompleted={onImportCompleted}
      onSetupPermissions={() => openAssignPermissions(createdRoleIdsRef.current, "import")}
      onApplied={({ created, updated, skipped, warningCount, importId }) => {
        /* Creates become full listing rows with freshly minted ids; updates
         * become field-level patches matched to the existing role by name. */
        const createdRows = created.map((r) => reviewRowToRoleCreate(r, makeImportedRoleId()));
        const updatePatches = updated.map(reviewRowToRoleUpdate);
        const result = upsertImportedRoles(createdRows, updatePatches);
        /* Only newly-created rows are Draft/empty; capture their ids for the
         * hand-off. Rows that turned out to update an existing role keep that
         * role's permissions and aren't part of the setup flow. */
        createdRoleIdsRef.current = createdRows.map((c) => c.row.id);
        setRolesImportNotice({
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
