/* The review step a module's Import wizard mounts in place of the Users
 * ImportReviewModal (ImportWizardModal `renderReview`). The wizard parses the
 * file with role-zen's sheet parser; its rows arrive as SheetRow objects
 * whose `values` are keyed by the module's own column keys. */

import type { ReviewStepContext } from "../import-wizard/ImportWizardModal";
import type { SheetRow } from "../sheet-import/sheetRecords";
import { ModuleImportReviewModal } from "./ModuleImportReviewModal";
import type { ModuleImportDef, ModuleRow } from "./moduleImportDefs";

function toModuleRows(parsed: unknown[]): ModuleRow[] {
  return (parsed as SheetRow[]).map((r) => ({ ...(r?.values ?? {}) }));
}

export function renderModuleReview(def: ModuleImportDef, moduleSlug: string) {
  return function ModuleReviewStep(ctx: ReviewStepContext) {
    return (
      <ModuleImportReviewModal
        def={def}
        open={ctx.open}
        moduleSlug={moduleSlug}
        importName={ctx.importName}
        importDescription={ctx.importDescription}
        fileName={ctx.fileName}
        parsedRows={toModuleRowsMemo(ctx.parsedRows)}
        sessionParentId={ctx.sessionParentId}
        onClose={ctx.onClose}
        onCompleted={ctx.onCompleted}
      />
    );
  };
}

/* The review resets its grid whenever `parsedRows` changes identity, so the
 * same parsed array must map to the same rows array across renders. */
const cache = new WeakMap<object, ModuleRow[]>();
function toModuleRowsMemo(parsed: unknown[]): ModuleRow[] {
  const hit = cache.get(parsed);
  if (hit) return hit;
  const rows = toModuleRows(parsed);
  cache.set(parsed, rows);
  return rows;
}
