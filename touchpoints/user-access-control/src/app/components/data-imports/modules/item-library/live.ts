/* The live option sources nimble-palette's spec.ts reads from its app
 * (CreateItemModal CATEGORIES / LOCATIONS / MOCK_USERS / UOMS,
 * MaterialHandlingSection MOCK_APPROVERS, purchasing AVAILABLE_VENDORS,
 * configAtoms allUnitNames / uomCategory), rebuilt from the OPTION_SNAPSHOTS
 * the same repo pins to those constants (nimble-palette
 * src/app/import-export/spec.options.test.ts). The parity test in
 * src/test/module-import-validation-parity.test.ts checks the resulting spec
 * against the home repo's live one. */

import { OPTION_SNAPSHOTS } from "./spec.data.mjs";

type Pair = readonly [string, string];

export const CATEGORIES: { name: string; description: string }[] = (OPTION_SNAPSHOTS.categories as unknown as Pair[]).map(
  ([name, description]) => ({ name, description }),
);
export const LOCATIONS: string[] = [...(OPTION_SNAPSHOTS.locations as readonly string[])];
export const MOCK_USERS: { name: string; role: string }[] = (OPTION_SNAPSHOTS.users as unknown as Pair[]).map(([name, role]) => ({ name, role }));
export const UOMS: string[] = [...(OPTION_SNAPSHOTS.priceUnits as readonly string[])];
export const MOCK_APPROVERS: { name: string; role: string }[] = (OPTION_SNAPSHOTS.approvers as unknown as Pair[]).map(([name, role]) => ({ name, role }));
export const AVAILABLE_VENDORS: { name: string }[] = (OPTION_SNAPSHOTS.partners as readonly string[]).map((name) => ({ name }));

const UNIT_CATEGORY = new Map<string, string>((OPTION_SNAPSHOTS.units as unknown as Pair[]).map(([u, c]) => [u, c]));
export function allUnitNames(): string[] {
  return [...UNIT_CATEGORY.keys()];
}
export function uomCategory(unit: string): string | undefined {
  return UNIT_CATEGORY.get(unit);
}

/** The slice of nimble-palette's `Item` that buildValidationContext reads. */
export interface Item {
  partNumber: string;
  primaryCategory: string;
  additionalCategories?: string[];
}
