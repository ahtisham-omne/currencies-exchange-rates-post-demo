/* Provenance: nimble-palette/src/app/import-export/validation.ts
 * sha256 83e538945fff76f1b70af04bafefeb314056aca503d5faf23c5672ebeaac022e
 * Copied into role-zen 2026-09-30. Edits: 1 import/field line(s) rewritten for role-zen (see git diff vs source). 27 Oct 2026: the 5000-character description cap removed, rule and copy (Omne does not cap descriptions; ERP-9664). Otherwise rules and copy unchanged. */
/* Validation rules for the Items import review grid. Port of the User
 * Access Control validation.ts shape (per-cell issues, per-row status
 * error > warning > ready, isUpdate by natural key) with the rules from
 * docs/import-export/SPEC.md section 4.2.
 *
 * Severity follows UAC: anything that has no safe landing is an error
 * (required key, duplicate key, unknown primary category, unknown base unit,
 * unreadable numbers / pairs, out-of-range numbers, over-long description);
 * anything the import can land safely is a warning (unrecognised enum ->
 * default, unknown reference -> dropped, conditional value -> ignored). */

import type { Item } from "./live";
import {
  ENUMS,
  ITEMS_IMPORT_SPEC,
  matchOption,
  normalizeKey,
  parseYesNo,
  splitPipe,
  type EntitySpec,
  type ItemReviewField,
  type ItemReviewRow,
} from "./spec";
import { parseTags, TAG_MAX } from "./helpers";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "REQUIRED_EMPTY"
  | "DUPLICATE_KEY"
  | "TAG_TOO_LONG"
  | "CATEGORY_NOT_FOUND"
  | "ADDITIONAL_EQUALS_PRIMARY"
  | "INVALID_DROPDOWN"
  | "UNIT_NOT_FOUND"
  | "INVALID_ALT_UNIT"
  | "INVALID_NUMBER"
  | "RANGE_INVALID"
  | "INVALID_PRICE"
  | "CONDITIONAL_IGNORED"
  | "MISSING_CONDITIONAL"
  | "REFERENCE_NOT_FOUND";

export interface CellIssue {
  field: ItemReviewField;
  severity: IssueSeverity;
  code: IssueCode;
  /** One sentence shown in the cell tooltip and the row summary. */
  message: string;
  /** Guide copy: what the rule is and how to fix it. */
  explanation: string;
  /** A value that would pass, when one exists. */
  example?: string;
  /** Accepted values, when the rule is an enum / reference. */
  options?: string[];
}

export type RowStatus = "ready" | "warning" | "error";

export interface RowValidation {
  status: RowStatus;
  issues: CellIssue[];
  byField: Partial<Record<ItemReviewField, CellIssue[]>>;
  /** Part Number matches an existing item: the row updates it instead of creating. */
  isUpdate: boolean;
}

export interface ValidationResult {
  rows: RowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
  updateRowCount: number;
  createRowCount: number;
}

/** Lower-cased lookups. A missing lookup skips that reference rule. */
export interface ValidationContext {
  /** normalised part numbers of items already in the listing */
  existingKeys?: Set<string>;
  /** lower-cased category code / name -> canonical */
  knownCategories?: Map<string, string>;
  /** lower-cased unit name -> canonical */
  knownUnits?: Map<string, string>;
  /** canonical unit name -> UOM category */
  unitCategory?: Map<string, string>;
  /** lower-cased price-tier unit -> canonical */
  knownPriceUnits?: Map<string, string>;
  knownLocations?: Map<string, string>;
  knownPartners?: Map<string, string>;
  knownUsers?: Map<string, string>;
  knownApprovers?: Map<string, string>;
}

/** Context from the live store + spec option lists. Categories include the
 *  catalog codes plus every category name already used by an item. */
export function buildValidationContext(items: readonly Item[], spec: EntitySpec = ITEMS_IMPORT_SPEC): ValidationContext {
  const existingKeys = new Set<string>();
  const knownCategories = new Map(spec.lookups.categories);
  for (const it of items) {
    const k = normalizeKey(it.partNumber);
    if (k) existingKeys.add(k);
    for (const c of [it.primaryCategory, ...(it.additionalCategories ?? [])]) {
      const ck = normalizeKey(c);
      if (ck && !knownCategories.has(ck)) knownCategories.set(ck, c);
    }
  }
  return {
    existingKeys,
    knownCategories,
    knownUnits: spec.lookups.units,
    unitCategory: spec.lookups.unitCategory,
    knownPriceUnits: spec.lookups.priceUnits,
    knownLocations: spec.lookups.locations,
    knownPartners: spec.lookups.partners,
    knownUsers: spec.lookups.users,
    knownApprovers: spec.lookups.approvers,
  };
}

/* ─── Helpers ─── */

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

function parseNumber(value: string): number | null {
  const v = String(value ?? "").trim().replace(/,/g, "");
  if (!v || !NUMBER_RE.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function listOf(options: readonly string[]): string {
  if (options.length <= 1) return options.join("");
  if (options.length === 2) return `${options[0]} or ${options[1]}`;
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}

function quoteList(names: string[]): string {
  if (names.length === 1) return `"${names[0]}"`;
  if (names.length === 2) return `"${names[0]}" and "${names[1]}"`;
  return `"${names[0]}", "${names[1]}", and ${names.length - 2} more`;
}

const EXPLANATIONS: Record<IssueCode, string> = {
  REQUIRED_EMPTY: "This column is required on every row it applies to. Enter a value before importing.",
  DUPLICATE_KEY: "Each part number may appear only once in a file. Keep one row per item, or give the second row a different part number.",
  TAG_TOO_LONG: "Each tag can be up to 30 characters. Longer tags are shortened to the first 30 characters and the row still imports.",
  CATEGORY_NOT_FOUND: "Categories must already exist in Omne. Use a category code from the Valid Values sheet, such as C-1004.",
  ADDITIONAL_EQUALS_PRIMARY: "The primary category is never repeated under Additional Categories. Remove it from this cell.",
  INVALID_DROPDOWN: "This column accepts a fixed set of values. Pick one from the list; the import falls back to the default otherwise.",
  UNIT_NOT_FOUND: "Units must match a unit name in Omne, such as Each, Box, or Kilogram. See the Valid Values sheet.",
  INVALID_ALT_UNIT: "Alternative Units are written as Unit=factor, for example Box=12, separated with a pipe character ( | ). Each unit must come from a different category than the base unit.",
  INVALID_NUMBER: "Enter a plain number with no units or symbols.",
  RANGE_INVALID: "The number is outside the range Omne accepts for this column.",
  INVALID_PRICE: "Write each price tier as the price, a space, then the unit, for example 12.50 Each. Separate tiers with a pipe character ( | ).",
  CONDITIONAL_IGNORED: "This value only applies together with another column's setting. It will be ignored unless that setting is on.",
  MISSING_CONDITIONAL: "The setting in another column expects a value here.",
  REFERENCE_NOT_FOUND: "Names must match values that already exist in Omne. Matching is not case sensitive. Unknown names are dropped and the row still imports.",
};

type Issues = CellIssue[];

function push(issues: Issues, partial: Omit<CellIssue, "explanation"> & { explanation?: string }): void {
  issues.push({ ...partial, explanation: partial.explanation ?? EXPLANATIONS[partial.code] });
}

/* ─── The rules ─── */

export function validateRows(
  rows: readonly ItemReviewRow[],
  ctx: ValidationContext = {},
  spec: EntitySpec = ITEMS_IMPORT_SPEC,
): ValidationResult {
  const existingKeys = ctx.existingKeys ?? new Set<string>();
  const col = spec.columnByKey;
  const label = (f: ItemReviewField) => col[f].label;
  const example = (f: ItemReviewField) => col[f].example1 || undefined;

  /* Cross-row duplicate table */
  const keyToRows = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = normalizeKey(r.partNumber);
    if (!k) return;
    const arr = keyToRows.get(k);
    if (arr) arr.push(i + 1);
    else keyToRows.set(k, [i + 1]);
  });

  const perRow: RowValidation[] = rows.map((r, i) => {
    const issues: Issues = [];
    const rowNumber = i + 1;

    /* 1. Part Number: required on every row, the matching key. */
    const key = normalizeKey(r.partNumber);
    if (!key) {
      push(issues, {
        code: "REQUIRED_EMPTY",
        severity: "error",
        field: "partNumber",
        message: `${label("partNumber")} is required and cannot be empty.`,
        example: example("partNumber"),
      });
    } else {
      const matches = keyToRows.get(key) ?? [];
      if (matches.length > 1) {
        const others = matches.filter((n) => n !== rowNumber);
        push(issues, {
          code: "DUPLICATE_KEY",
          severity: "error",
          field: "partNumber",
          message: `Duplicate part number. This part number also appears in row ${others.join(", ")}.`,
        });
      }
    }
    const hasKeyError = issues.some((x) => x.field === "partNumber" && x.severity === "error");
    const isUpdate = !!key && !hasKeyError && existingKeys.has(key);

    /* 2. Description: no length limit (Omne does not cap descriptions). */

    /* 3. Tags: each entry up to TAG_MAX characters; longer ones are shortened with a warning. */
    const { truncated } = parseTags(r.tags);
    if (truncated.length > 0) {
      const many = truncated.length > 1;
      push(issues, {
        code: "TAG_TOO_LONG",
        severity: "warning",
        field: "tags",
        message: `Tag${many ? "s" : ""} ${quoteList(truncated)} ${many ? "are" : "is"} longer than ${TAG_MAX} characters and will be shortened.`,
      });
    }

    /* Enum helper: unrecognised -> warning, returns the canonical value or null. */
    const enumValue = (field: ItemReviewField, options: readonly string[], noun: string): string | null => {
      const raw = r[field].trim();
      if (!raw) return null;
      const hit = matchOption(raw, options);
      if (hit) return hit;
      const def = col[field].defaultValue;
      const landing = isUpdate
        ? "The existing value will be kept."
        : def
          ? `The item will import with ${def}.`
          : "The item will import without a value here.";
      push(issues, {
        code: "INVALID_DROPDOWN",
        severity: "warning",
        field,
        message: `"${raw}" is not a recognised ${noun}. ${landing} Use ${listOf(options)}.`,
        options: [...options],
        example: example(field),
      });
      return null;
    };

    const yesNo = (field: ItemReviewField): boolean | null => {
      const raw = r[field].trim();
      if (!raw) return null;
      const v = parseYesNo(raw);
      if (v !== null) return v;
      push(issues, {
        code: "INVALID_DROPDOWN",
        severity: "warning",
        field,
        message: `"${raw}" is not a recognised value for ${label(field)}. ${isUpdate ? "The existing setting will be kept." : "The setting will be left off."} Use Yes or No.`,
        options: [...ENUMS.yesno],
        example: "Yes",
      });
      return null;
    };

    /* Reference helper: unknown names -> one warning per column. */
    const references = (
      field: ItemReviewField,
      known: Map<string, string> | undefined,
      nounSingular: string,
      nounPlural: string,
    ): string[] => {
      const declared = splitPipe(r[field]);
      if (declared.length === 0 || !known || known.size === 0) return declared;
      const unknown = declared.filter((n) => !known.has(n.toLowerCase()));
      if (unknown.length > 0) {
        const one = unknown.length === 1;
        push(issues, {
          code: "REFERENCE_NOT_FOUND",
          severity: "warning",
          field,
          message: one
            ? `${nounSingular} ${quoteList(unknown)} doesn't exist in Omne. The item will import without this ${nounSingular.toLowerCase()}.`
            : `${nounPlural} ${quoteList(unknown)} don't exist in Omne. The item will import without these ${nounPlural.toLowerCase()}.`,
          example: example(field),
        });
      }
      return declared.filter((n) => known.has(n.toLowerCase()));
    };

    /* 3. Status */
    enumValue("status", ENUMS.status, "status");

    /* 4. Primary Category: required on create; must exist. */
    const primaryRaw = r.primaryCategory.trim();
    if (!primaryRaw) {
      if (!isUpdate) {
        push(issues, {
          code: "REQUIRED_EMPTY",
          severity: "error",
          field: "primaryCategory",
          message: `${label("primaryCategory")} is required and cannot be empty.`,
          example: example("primaryCategory"),
        });
      }
    } else if (ctx.knownCategories && ctx.knownCategories.size > 0 && !ctx.knownCategories.has(primaryRaw.toLowerCase())) {
      push(issues, {
        code: "CATEGORY_NOT_FOUND",
        severity: "error",
        field: "primaryCategory",
        message: `Category "${primaryRaw}" doesn't exist in Omne. Enter a category code from the Valid Values sheet, such as C-1004.`,
        example: example("primaryCategory"),
      });
    }

    /* 5. Additional Categories: unknown dropped (warning), primary repeated (warning). */
    const additional = splitPipe(r.additionalCategories);
    if (additional.length > 0) {
      const dupPrimary = additional.filter((c) => primaryRaw && c.toLowerCase() === primaryRaw.toLowerCase());
      if (dupPrimary.length > 0) {
        push(issues, {
          code: "ADDITIONAL_EQUALS_PRIMARY",
          severity: "warning",
          field: "additionalCategories",
          message: `"${dupPrimary[0]}" is already the primary category. It will be dropped from Additional Categories.`,
        });
      }
      if (ctx.knownCategories && ctx.knownCategories.size > 0) {
        const unknown = additional.filter((c) => !ctx.knownCategories!.has(c.toLowerCase()));
        if (unknown.length > 0) {
          push(issues, {
            code: "CATEGORY_NOT_FOUND",
            severity: "warning",
            field: "additionalCategories",
            message:
              unknown.length === 1
                ? `Category ${quoteList(unknown)} doesn't exist in Omne. The item will import without this category.`
                : `Categories ${quoteList(unknown)} don't exist in Omne. The item will import without these categories.`,
            example: example("additionalCategories"),
          });
        }
      }
    }

    /* 6. Item Definition enums and toggles */
    enumValue("inventoryType", ENUMS.inventoryType, "inventory type");
    const control = enumValue("inventoryControlType", ENUMS.inventoryControlType, "inventory control");
    const lot = yesNo("lotControl");
    const lotOn = lot === true;
    const lotKnown = lot !== null || !isUpdate; /* create rows default to No */

    const lotId = enumValue("lotIdSource", ENUMS.lotIdSource, "lot ID assignment");
    if (lotId && !lotOn && lotKnown) {
      push(issues, {
        code: "CONDITIONAL_IGNORED",
        severity: "warning",
        field: "lotIdSource",
        message: "Lot ID Assignment only applies when Lot Tracking is Yes. This value will be ignored.",
      });
    }

    /* 7. Shelf life */
    const shelfRaw = r.shelfLifeValue.trim();
    let shelf: number | null = null;
    if (shelfRaw) {
      shelf = parseNumber(shelfRaw);
      if (shelf === null || shelf < 0) {
        push(issues, {
          code: shelf === null ? "INVALID_NUMBER" : "RANGE_INVALID",
          severity: "error",
          field: "shelfLifeValue",
          message: "Shelf Life must be a number, 0 or more, such as 24.",
          example: "24",
        });
      }
    }
    const shelfUnit = enumValue("shelfLifeUnit", ENUMS.shelfLifeUnit, "shelf life unit");
    if (shelfUnit && !shelfRaw && !isUpdate) {
      push(issues, {
        code: "CONDITIONAL_IGNORED",
        severity: "warning",
        field: "shelfLifeUnit",
        message: "Shelf Life Unit only applies when Shelf Life has a value. This value will be ignored.",
      });
    }

    /* 8. Base unit: unknown = error. */
    const unitRaw = r.unit.trim();
    let baseUnit: string | null = null;
    if (unitRaw) {
      const hit = ctx.knownUnits?.get(unitRaw.toLowerCase());
      if (ctx.knownUnits && ctx.knownUnits.size > 0 && !hit) {
        push(issues, {
          code: "UNIT_NOT_FOUND",
          severity: "error",
          field: "unit",
          message: `Unit "${unitRaw}" doesn't exist in Omne. Use a unit name from the Valid Values sheet, such as Each or Kilogram.`,
          example: "Each",
          options: ctx.knownUnits ? [...ctx.knownUnits.values()] : undefined,
        });
      } else {
        baseUnit = hit ?? unitRaw;
      }
    } else if (!isUpdate) {
      baseUnit = col.unit.defaultValue || null;
    }

    /* 9. Alternative units: Unit=factor pairs from another UOM category. */
    const altParts = splitPipe(r.alternativeUnits);
    if (altParts.length > 0) {
      const baseCat = baseUnit ? ctx.unitCategory?.get(baseUnit) : undefined;
      for (const part of altParts) {
        const m = part.match(/^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
        if (!m) {
          push(issues, {
            code: "INVALID_ALT_UNIT",
            severity: "error",
            field: "alternativeUnits",
            message: `Alternative Units must be written as Unit=factor, such as Box=12. "${part}" could not be read.`,
            example: example("alternativeUnits"),
          });
          continue;
        }
        const uRaw = m[1].trim();
        const factor = Number(m[2]);
        const canonical = ctx.knownUnits?.get(uRaw.toLowerCase());
        if (ctx.knownUnits && ctx.knownUnits.size > 0 && !canonical) {
          push(issues, {
            code: "INVALID_ALT_UNIT",
            severity: "error",
            field: "alternativeUnits",
            message: `Unit "${uRaw}" in Alternative Units doesn't exist in Omne. Use a unit name from the Valid Values sheet.`,
            example: example("alternativeUnits"),
          });
          continue;
        }
        if (!(factor > 0)) {
          push(issues, {
            code: "INVALID_ALT_UNIT",
            severity: "error",
            field: "alternativeUnits",
            message: `The factor for "${uRaw}" must be greater than 0, such as ${uRaw}=12.`,
            example: example("alternativeUnits"),
          });
          continue;
        }
        const u = canonical ?? uRaw;
        if (baseUnit && u.toLowerCase() === baseUnit.toLowerCase()) {
          push(issues, {
            code: "INVALID_ALT_UNIT",
            severity: "error",
            field: "alternativeUnits",
            message: `"${u}" is the base unit. Alternative Units must be a different unit from a different category.`,
          });
          continue;
        }
        const altCat = ctx.unitCategory?.get(u);
        if (baseCat && altCat && altCat === baseCat) {
          push(issues, {
            code: "INVALID_ALT_UNIT",
            severity: "error",
            field: "alternativeUnits",
            message: `"${u}" shares a unit category (${altCat}) with the base unit ${baseUnit}. Alternatives must come from a different category.`,
          });
        }
      }
    }

    /* 10. Acquisition methods + primary */
    const methodsDeclared = splitPipe(r.acquisitionMethods);
    const methods: string[] = [];
    for (const mRaw of methodsDeclared) {
      const hit = matchOption(mRaw, ENUMS.acquisitionMethods);
      if (hit) {
        if (!methods.includes(hit)) methods.push(hit);
      } else {
        push(issues, {
          code: "INVALID_DROPDOWN",
          severity: "warning",
          field: "acquisitionMethods",
          message: `"${mRaw}" is not a recognised acquisition method. It will be dropped. Use ${listOf(ENUMS.acquisitionMethods)}.`,
          options: [...ENUMS.acquisitionMethods],
          example: example("acquisitionMethods"),
        });
      }
    }
    const effectiveMethods = methods.length > 0 ? methods : isUpdate ? null : [col.acquisitionMethods.defaultValue];
    const primaryAcq = enumValue("primaryAcquisition", ENUMS.acquisitionMethods, "acquisition method");
    if (primaryAcq && effectiveMethods && !effectiveMethods.includes(primaryAcq)) {
      push(issues, {
        code: "CONDITIONAL_IGNORED",
        severity: "warning",
        field: "primaryAcquisition",
        message: `Primary Acquisition must be one of the values in Acquisition Method. "${primaryAcq}" will be ignored.`,
        options: effectiveMethods,
      });
    }

    /* 11. Stock levels */
    const numberField = (field: ItemReviewField, min: number | null, msg: string, ex: string): number | null => {
      const raw = r[field].trim();
      if (!raw) return null;
      const n = parseNumber(raw);
      if (n === null || (min !== null && n < min)) {
        push(issues, { code: n === null ? "INVALID_NUMBER" : "RANGE_INVALID", severity: "error", field, message: msg, example: ex });
        return null;
      }
      return n;
    };
    const minStock = numberField("minStock", 0, "Min Level must be a number, 0 or more, such as 5.", "5");
    const maxStock = numberField("maxStock", 0, "Max Level must be a number, 0 or more, such as 200.", "200");
    if (r.minStock.trim() || r.maxStock.trim()) {
      const effMin = minStock ?? (r.minStock.trim() ? null : isUpdate ? null : parseNumber(col.minStock.defaultValue));
      const effMax = maxStock ?? (r.maxStock.trim() ? null : isUpdate ? null : parseNumber(col.maxStock.defaultValue));
      if (effMin !== null && effMax !== null && effMin >= effMax) {
        push(issues, {
          code: "RANGE_INVALID",
          severity: "error",
          field: "minStock",
          message: "Min level must be less than max level.",
          example: example("minStock"),
        });
      }
    }

    /* 12. Locations */
    references("inboundLocations", ctx.knownLocations, "Location", "Locations");
    references("outboundLocations", ctx.knownLocations, "Location", "Locations");
    references("receivingStagingLocation", ctx.knownLocations, "Location", "Locations");
    references("shippingStagingLocation", ctx.knownLocations, "Location", "Locations");

    /* 13. Procurement numbers */
    const minPurchase = numberField("minPurchase", 0, "Min Order Qty must be a number, 0 or more, such as 10.", "10");
    const maxPurchase = numberField("maxPurchase", 0, "Max Order Qty must be a number, 0 or more, such as 500.", "500");
    if (r.minPurchase.trim() || r.maxPurchase.trim()) {
      const effMin = minPurchase ?? (r.minPurchase.trim() ? null : isUpdate ? null : parseNumber(col.minPurchase.defaultValue));
      const effMax = maxPurchase ?? (r.maxPurchase.trim() ? null : isUpdate ? null : parseNumber(col.maxPurchase.defaultValue));
      if (effMin !== null && effMax !== null && effMax < effMin) {
        push(issues, {
          code: "RANGE_INVALID",
          severity: "error",
          field: "maxPurchase",
          message: "Max Order Qty must be at least Min Order Qty.",
          example: example("maxPurchase"),
        });
      }
    }
    const multRaw = r.multiples.trim();
    if (multRaw) {
      const n = parseNumber(multRaw);
      if (n === null || !(n > 0)) {
        push(issues, {
          code: n === null ? "INVALID_NUMBER" : "RANGE_INVALID",
          severity: "error",
          field: "multiples",
          message: "Order Multiples must be a number greater than 0, such as 10.",
          example: "10",
        });
      }
    }
    enumValue("shortageRule", ENUMS.shortageRule, "PO recommendation rule");

    /* 14. Selling */
    const scope = enumValue("sellingScope", ENUMS.sellingScope, "selling scope");
    const scopeKnown = scope !== null || !isUpdate;
    const scopeSpecific = scope === "Specific";
    const partners = references("specificPartners", ctx.knownPartners, "Partner", "Partners");
    if (splitPipe(r.specificPartners).length > 0 && scopeKnown && !scopeSpecific) {
      push(issues, {
        code: "CONDITIONAL_IGNORED",
        severity: "warning",
        field: "specificPartners",
        message: "Specific Partners only applies when Selling Scope is Specific. These partners will be ignored.",
      });
    }
    if (scopeSpecific && partners.length === 0 && !isUpdate) {
      push(issues, {
        code: "MISSING_CONDITIONAL",
        severity: "warning",
        field: "specificPartners",
        message: "Selling Scope is Specific but no partners are listed. The item will import without any partners it can be sold to.",
        example: example("specificPartners"),
      });
    }

    /* 15. Pricing tiers */
    const tiers = splitPipe(r.pricing);
    for (const tier of tiers) {
      const m = tier.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (!m) {
        push(issues, {
          code: "INVALID_PRICE",
          severity: "error",
          field: "pricing",
          message: `Custom Price Per Unit must be written as the price, a space, then the unit, such as 12.50 Each. "${tier}" could not be read.`,
          example: example("pricing"),
        });
        continue;
      }
      const uRaw = m[2].trim();
      if (ctx.knownPriceUnits && ctx.knownPriceUnits.size > 0 && !ctx.knownPriceUnits.has(uRaw.toLowerCase())) {
        push(issues, {
          code: "INVALID_PRICE",
          severity: "error",
          field: "pricing",
          message: `Price unit "${uRaw}" is not recognised. Use one of: ${[...ctx.knownPriceUnits.values()].join(", ")}.`,
          options: [...ctx.knownPriceUnits.values()],
          example: example("pricing"),
        });
      }
    }

    /* 16. Governance */
    enumValue("valuationMethod", ENUMS.valuationMethod, "inventory valuation method");
    references("owners.materialHandling", ctx.knownUsers, "User", "Users");
    references("owners.purchasing", ctx.knownUsers, "User", "Users");
    references("owners.finance", ctx.knownUsers, "User", "Users");

    /* 17. Material handling */
    const tolRaw = r.cycleTolerance.trim();
    if (tolRaw) {
      const n = parseNumber(tolRaw);
      if (n === null || n < 0 || n > 100) {
        push(issues, {
          code: n === null ? "INVALID_NUMBER" : "RANGE_INVALID",
          severity: "error",
          field: "cycleTolerance",
          message: "Acceptable Variance must be a number between 0 and 100, such as 2.",
          example: "2",
        });
      }
    }
    references("approvers", ctx.knownApprovers, "Approver", "Approvers");
    yesNo("scanLocation");
    yesNo("scanItem");
    yesNo("scanLot");
    const serial = yesNo("scanSerial");
    const controlKnown = control !== null || !isUpdate;
    const serialized = control === "Serialized";
    if (serial === true && controlKnown && !serialized) {
      push(issues, {
        code: "CONDITIONAL_IGNORED",
        severity: "warning",
        field: "scanSerial",
        message: "Serial Scan only applies when Inventory Control is Serialized. It will be ignored.",
      });
    }

    /* Group by field */
    const byField: Partial<Record<ItemReviewField, CellIssue[]>> = {};
    for (const issue of issues) {
      const bucket = byField[issue.field] ?? [];
      bucket.push(issue);
      byField[issue.field] = bucket;
    }
    const hasError = issues.some((x) => x.severity === "error");
    const hasWarning = issues.some((x) => x.severity === "warning");
    const status: RowStatus = hasError ? "error" : hasWarning ? "warning" : "ready";
    return { status, issues, byField, isUpdate };
  });

  let errorRowCount = 0;
  let warningRowCount = 0;
  let readyRowCount = 0;
  let updateRowCount = 0;
  let createRowCount = 0;
  for (const r of perRow) {
    if (r.status === "error") errorRowCount++;
    else if (r.status === "warning") warningRowCount++;
    else readyRowCount++;
    if (r.status !== "error") {
      if (r.isUpdate) updateRowCount++;
      else createRowCount++;
    }
  }
  return { rows: perRow, errorRowCount, warningRowCount, readyRowCount, updateRowCount, createRowCount };
}

/** Guide copy for an issue code (used by the review grid's issue tooltip). */
export function describeIssue(code: IssueCode): string {
  return EXPLANATIONS[code];
}
