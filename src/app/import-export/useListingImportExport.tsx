/* Host hook for a listing page: owns the Actions menu, the Export modal,
 * the Import wizard and the post-import notice for one entity spec. Mounted
 * once on /vendors and once on /partners/groups. */

import { useCallback, useMemo, useState } from "react";
import type { EntitySpec } from "./spec";
import type { ValidationContext } from "./validation";
import type { ReferenceOptions } from "./reviewParts";
import type { ImportOutcome } from "./ImportReviewModal";
import { ActionsMenu } from "./ActionsMenu";
import { ExportModal, type ExportContext } from "./ExportModal";
import { ImportWizardModal } from "./ImportWizardModal";
import { ImportNoticeBanner, type ImportNotice } from "./ImportNoticeBanner";

interface Args<T> {
  spec: EntitySpec<T>;
  /** Every exportable row (archived already excluded). */
  allRows: T[];
  /** The listing's filtered + sorted rows (archived already excluded). */
  filteredRows: T[];
  /** Read at click time: is any search / filter active. */
  isFiltered: () => boolean;
  columnVisibility: Record<string, boolean>;
  /** Snapshotted when the wizard opens. */
  buildValidationContext: () => ValidationContext;
  referenceOptions: ReferenceOptions;
  /** Fold the reviewed rows into the store; return the real counts. */
  onApplied: (outcome: ImportOutcome) => { created: number; updated: number };
  /** Resets the listing's search, quick filters, filters and column filters (Export modal "Clear filters"). */
  clearFilters?: () => void;
  /** Selects every row the listing shows (Export modal "Select all"). */
  selectAll?: () => void;
}

export function useListingImportExport<T>({ spec, allRows, filteredRows, isFiltered, columnVisibility, buildValidationContext, referenceOptions, onApplied, clearFilters, selectAll }: Args<T>) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportContext, setExportContext] = useState<ExportContext | null>(null);
  const [exportRows, setExportRows] = useState<T[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [notice, setNotice] = useState<ImportNotice | null>(null);

  const openHeaderExport = useCallback(() => {
    const filtered = isFiltered();
    setExportContext(filtered ? { kind: "filtered", filteredCount: filteredRows.length, totalCount: allRows.length } : { kind: "all", totalCount: allRows.length });
    setExportRows(filteredRows);
    setExportOpen(true);
  }, [isFiltered, filteredRows, allRows.length]);

  const openSelectedExport = useCallback((rows: T[]) => {
    setExportContext({ kind: "selected", selectedCount: rows.length });
    setExportRows(rows);
    setExportOpen(true);
  }, []);

  /* Export modal scope actions: rows are resolved here, not from listing
     state that has not re-rendered yet. */
  const handleClearFilters = useCallback(() => {
    clearFilters?.();
    setExportContext({ kind: "all", totalCount: allRows.length });
    setExportRows(allRows);
  }, [clearFilters, allRows]);

  const handleSelectAll = useCallback(() => {
    selectAll?.();
    const filtered = isFiltered();
    setExportContext(filtered ? { kind: "filtered", filteredCount: filteredRows.length, totalCount: allRows.length } : { kind: "all", totalCount: allRows.length });
    setExportRows(filteredRows);
  }, [selectAll, isFiltered, filteredRows, allRows.length]);

  const validationContext = useMemo(() => (wizardOpen ? buildValidationContext() : undefined), [wizardOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionsMenu = <ActionsMenu onImport={() => setWizardOpen(true)} onExport={openHeaderExport} />;

  const modals = (
    <>
      <ExportModal spec={spec} open={exportOpen} onClose={() => setExportOpen(false)} context={exportContext} tableColumnVisibility={columnVisibility} rows={exportRows} onClearFilters={clearFilters ? handleClearFilters : undefined} onSelectAll={selectAll ? handleSelectAll : undefined} />
      <ImportWizardModal
        spec={spec as EntitySpec<unknown>}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        validationContext={validationContext}
        referenceOptions={referenceOptions}
        onApplied={(outcome) => {
          const result = onApplied(outcome);
          setNotice({ created: result.created, updated: result.updated, skipped: outcome.skipped.length, warnings: outcome.warningCount, importId: outcome.importId });
        }}
      />
    </>
  );

  const noticeBanner = <ImportNoticeBanner spec={spec as EntitySpec<unknown>} notice={notice} onDismiss={() => setNotice(null)} />;

  return { actionsMenu, modals, notice: noticeBanner, openSelectedExport, openImport: () => setWizardOpen(true) };
}
