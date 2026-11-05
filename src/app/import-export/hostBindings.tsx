/* Store bindings for a spec: what the wizard needs from the two contexts
 * (validation snapshot, reference option names, the fold-in on apply).
 * Used by the history and record pages, which are not tied to one listing. */

import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { CONTACT_DICTIONARY } from "../components/vendors/partnerConstants";
import { useVendors } from "../context/VendorContext";
import { usePartnerGroups } from "../context/PartnerGroupsContext";
import { PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC, type EntitySpec, type ImportRow } from "./spec";
import { buildValidationContext, type ValidationContext } from "./validation";
import type { ReferenceOptions } from "./reviewParts";
import type { ImportOutcome } from "./ImportReviewModal";

/** The spec for the current route: `/vendors/imports*` is Partners, the rest Partner Groups. */
export function useRouteImportSpec(): EntitySpec<unknown> {
  const { pathname } = useLocation();
  return (pathname.startsWith("/vendors") ? PARTNERS_IMPORT_SPEC : PARTNER_GROUPS_IMPORT_SPEC) as EntitySpec<unknown>;
}

export function useImportHostBindings(spec: EntitySpec<unknown>) {
  const vendorsCtx = useVendors();
  const groupsCtx = usePartnerGroups();
  const isGroups = spec.storageNamespace === "partner-groups";
  const vendors = vendorsCtx.vendors;
  const groups = groupsCtx.groups;

  const referenceOptions = useMemo<ReferenceOptions>(
    () => ({
      groups: groups.map((g) => g.name),
      partners: vendors.map((v) => v.displayName).filter(Boolean),
      contacts: Array.from(new Set(CONTACT_DICTIONARY.map((c) => c.name).filter(Boolean))),
    }),
    [groups, vendors],
  );

  const makeValidationContext = useCallback((): ValidationContext => buildValidationContext(spec, vendors, groups), [spec, vendors, groups]);

  const applyRows = useCallback(
    (rows: ImportRow[]): { created: number; updated: number } => (isGroups ? groupsCtx.upsertImportedGroups(rows, { partners: vendors }) : vendorsCtx.upsertImportedVendors(rows, { groups })),
    [isGroups, groupsCtx, vendorsCtx, vendors, groups],
  );

  const onApplied = useCallback((outcome: ImportOutcome) => applyRows([...outcome.created, ...outcome.updated]), [applyRows]);

  return { referenceOptions, makeValidationContext, applyRows, onApplied };
}
