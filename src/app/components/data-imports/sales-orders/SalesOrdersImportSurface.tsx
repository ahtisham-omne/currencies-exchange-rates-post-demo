/* Sales Orders' two entry points into the shared sheet-import engine: the wizard the
 * Data Imports header opens, and the record page a past import drills into.
 * Everything module-specific lives in salesOrdersSpec.ts, so these stay thin. */

import { useCallback } from "react";
import { addCompletedImport } from "../importHistory";
import { saveSheetImport, ensureSheetSeed } from "../sheet-import/sheetImportStore";
import { SheetImportWizardModal } from "../sheet-import/SheetImportWizardModal";
import { SheetImportRecordDetailPage } from "../sheet-import/SheetImportRecordDetailPage";
import { SALES_ORDERS_SPEC, EXISTING_SO_NUMBERS } from "./salesOrdersSpec";
import { SALES_ORDERS_MOCK_SEED } from "./salesOrdersMockData";

/** Lay down the seeded history the first time this surface is viewed in a page
 *  load. Called by the Data Imports listing alongside its own seeding. */
export function seedSalesOrdersImports(): void {
  ensureSheetSeed(SALES_ORDERS_SPEC, SALES_ORDERS_MOCK_SEED);
}

export function SalesOrdersImportWizard({
  open,
  onClose,
  onImportCompleted,
}: {
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
}) {
  /* An import writes two things: the listing entry the history table reads, and
     the row payload the record page reads. Both are keyed by the same id. */
  const handleApplied = useCallback(
    (
      outcome: Parameters<React.ComponentProps<typeof SheetImportWizardModal>["onApplied"]>[0],
      meta: { name: string; description: string; fileName: string },
    ) => {
      const id = `imp-sales-orders-${Date.now()}`;
      const dateISO = new Date().toISOString();
      addCompletedImport({
        id,
        moduleSlug: SALES_ORDERS_SPEC.slug,
        name: meta.name,
        fileName: meta.fileName,
        description: meta.description,
        dateISO,
        importerKey: "sj",
        recordCount: outcome.rows.length,
        importedCount: outcome.imported,
        failedCount: outcome.failed + outcome.skipped,
      });
      saveSheetImport({
        id,
        moduleSlug: SALES_ORDERS_SPEC.slug,
        name: meta.name,
        description: meta.description,
        fileName: meta.fileName,
        dateISO,
        importerKey: "sj",
        rows: outcome.rows,
      });
      onImportCompleted?.();
    },
    [onImportCompleted],
  );

  return (
    <SheetImportWizardModal
      open={open}
      spec={SALES_ORDERS_SPEC}
      existingKeys={EXISTING_SO_NUMBERS}
      onClose={onClose}
      onApplied={handleApplied}
    />
  );
}

export function SalesOrdersImportRecordDetailPage() {
  return <SheetImportRecordDetailPage spec={SALES_ORDERS_SPEC} seed={seedSalesOrdersImports} existingKeys={EXISTING_SO_NUMBERS} />;
}
