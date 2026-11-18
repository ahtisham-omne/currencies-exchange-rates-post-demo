/* Item Library import: special cell editors.
 *
 * Every other column follows the home module's Review and Fix Your Data
 * rule in renderModuleCellEditor (ModuleImportReviewModal.tsx): pipe lists
 * open the multi panel (search, checkboxes, "N selected", Done), single lists
 * the plain list (searchable once long), free text and numbers type in the
 * cell. Only Description and Tags keep the shared Data Imports editors, which
 * already read better than a dropdown for prose and chips.
 *
 * The earlier Create-flow pickers in ./item-library/ are no longer registered.
 */

import { registerSpecialEditors } from "./registry";
import { longTextEditorFor, tagsEditorFor } from "../../shared-cells/CommonFieldEditors";

registerSpecialEditors("item-library", {
  description: longTextEditorFor({ label: "Description" }),
  tags: tagsEditorFor("items"),
});
