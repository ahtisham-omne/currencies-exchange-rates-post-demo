import type { UserReviewRow } from "../import-review/usersReviewMockData";

export type ValidationState = "valid" | "failed";

export interface UploadedFile {
  name: string;
  sizeKB: number;
  rows: number;
  fields: number;
}

/** Wizard state parameterized on the parsed-row shape, so the Users and
 *  Roles wizards can share the exact same setup-step component while each
 *  carries its own review-row type. */
export interface ImportWizardDataOf<Row> {
  importName: string;
  uploadedFile: UploadedFile | null;
  validationState: ValidationState;
  /** Rows parsed out of the uploaded file. Populated by the setup step once
   *  the file is read; consumed by the review modal. Null until a successful
   *  upload + parse has completed. */
  parsedRows: Row[] | null;
}

export type ImportWizardData = ImportWizardDataOf<UserReviewRow>;

export const EMPTY_WIZARD: ImportWizardData = {
  importName: "",
  uploadedFile: null,
  validationState: "valid",
  parsedRows: null,
};
