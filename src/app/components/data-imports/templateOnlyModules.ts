/* Item Library, Categories, Partners and Partner Group on the Data Imports
 * page. Each runs the same Import modal as the Users module (ImportWizardModal
 * + ImportSetupStep), configured from here: title, subtitle, its shipped
 * template + guide under public/templates, the header row the parser checks
 * and the description placeholder. Review Data opens the Users review with
 * the module's own columns and rules (modules/ModuleImportReviewModal), and
 * every history row opens the Users record page for the module
 * (modules/ModuleImportRecordPage). Columns, headers and rules come from
 * modules/moduleImportDefs.ts, which reads each home repo's data layer. */

import type { ImportTemplateConfig } from "./import-wizard/ImportSetupStep";
import { makeSheetParser } from "./sheet-import/sheetParser";
import type { SheetImportSpec } from "./sheet-import/sheetSpec";
import {
  MODULE_IMPORT_DEFS,
  MODULE_IMPORT_SLUGS,
  isModuleImportSlug,
  type ModuleImportDef,
  type ModuleImportSlug,
} from "./modules/moduleImportDefs";
import { seedModuleImports } from "./modules/moduleImportStore";
import { PI_TABS, piTemplateFiles } from "./modules/physical-inventory/piModule";

export const TEMPLATE_ONLY_SLUGS = MODULE_IMPORT_SLUGS;
export type TemplateOnlySlug = ModuleImportSlug;

export function isTemplateOnlySlug(slug: string): slug is TemplateOnlySlug {
  return isModuleImportSlug(slug);
}

interface TemplateOnlyModuleConfig {
  /** File names under public/templates. Preview fields come from the headers. */
  template: Omit<ImportTemplateConfig, "previewFieldsText" | "remainingFields">;
  descriptionPlaceholder: string;
}

const MODULES: Record<TemplateOnlySlug, TemplateOnlyModuleConfig> = {
  "item-library": {
    template: {
      guideFilename: "OMNE_Items_Import_Guide.txt",
      guideTitle: "Items Import Guide",
      templateXlsxFilename: "OMNE_Items_Import_Template.xlsx",
      templateCsvFilename: "OMNE_Items_Import_Template.csv",
    },
    descriptionPlaceholder: "e.g. Q3 catalog update. A short note that helps you find this import later.",
  },
  categories: {
    template: {
      guideFilename: "OMNE_Categories_Import_Guide.txt",
      guideTitle: "Categories Import Guide",
      templateXlsxFilename: "OMNE_Categories_Import_Template.xlsx",
      templateCsvFilename: "OMNE_Categories_Import_Template.csv",
    },
    descriptionPlaceholder: "e.g. Q3 category restructure. A short note that helps you find this import later.",
  },
  partners: {
    template: {
      guideFilename: "OMNE_Partners_Import_Guide.txt",
      guideTitle: "Partners Import Guide",
      templateXlsxFilename: "OMNE_Partners_Import_Template.xlsx",
      templateCsvFilename: "OMNE_Partners_Import_Template.csv",
    },
    descriptionPlaceholder: "e.g. Q3 vendor onboarding. A short note that helps you find this import later.",
  },
  "partner-groups": {
    template: {
      guideFilename: "OMNE_Partner_Groups_Import_Guide.txt",
      guideTitle: "Partner Groups Import Guide",
      templateXlsxFilename: "OMNE_Partner_Groups_Import_Template.xlsx",
      templateCsvFilename: "OMNE_Partner_Groups_Import_Template.csv",
    },
    descriptionPlaceholder: "e.g. Q3 regional groups. A short note that helps you find this import later.",
  },
  /* Physical Inventory: one template per control-type tab, named as
     Physical Inventory names them (modules/physical-inventory/piModule.ts). */
  ...(Object.fromEntries(
    PI_TABS.map((t) => [t.slug, { template: piTemplateFiles(t.mode), descriptionPlaceholder: "e.g. Q3 restock. A short note that helps you find this import later." }]),
  ) as Record<(typeof PI_TABS)[number]["slug"], TemplateOnlyModuleConfig>),
};

export interface TemplateOnlyModule extends TemplateOnlyModuleConfig {
  def: ModuleImportDef;
  /** Plural entity noun, e.g. "Partner Groups": modal title and subtitle. */
  entities: string;
  /** The template's header row, exactly as shipped (required marked `*`). */
  headers: string[];
  /** Full setup-step template config: files + first five fields + the rest. */
  templateConfig: ImportTemplateConfig;
  title: string;
  subtitle: string;
  /** role-zen's sheet parser, pointed at this module's header row. Rows come
   *  back keyed by the module's own column keys. */
  parseFile: ReturnType<typeof makeSheetParser>;
}

function buildModule(slug: TemplateOnlySlug, cfg: TemplateOnlyModuleConfig): TemplateOnlyModule {
  const def = MODULE_IMPORT_DEFS[slug];
  const labels = def.columns.map((c) => c.label);
  const columns: SheetImportSpec["columns"] = def.columns.map((c) => ({
    key: c.key,
    label: c.label,
    level: "record",
    requirement: c.required ? "required" : "optional",
  }));
  const templateConfig: ImportTemplateConfig = {
    ...cfg.template,
    previewFieldsText: labels.slice(0, 5).map((l) => l.toLowerCase()).join(", "),
    remainingFields: labels.slice(5),
  };
  const spec: SheetImportSpec = {
    slug,
    recordLabel: def.entity,
    recordLabelPlural: def.entities,
    keyColumn: def.keyField,
    statusColumn: def.columns.find((c) => c.label === "Status")?.key ?? "",
    columns,
    catalogs: {},
    catalogModules: {},
    aliases: {},
    templateDir: "",
    templateXlsx: cfg.template.templateXlsxFilename,
    templateCsv: cfg.template.templateCsvFilename,
    guideFile: cfg.template.guideFilename,
    guideTitle: cfg.template.guideTitle,
    previewFieldsText: templateConfig.previewFieldsText,
    remainingFields: templateConfig.remainingFields,
    /* The home repo's header aliases ("SKU" for Part Number, ...). */
    resolveHeader: def.resolveHeader,
  };
  return {
    ...cfg,
    def,
    entities: def.entities,
    headers: [...def.templateHeaders],
    templateConfig,
    title: `Import ${def.entities}`,
    subtitle: `Upload a spreadsheet to add or update ${def.entities.toLowerCase()} in bulk.`,
    parseFile: makeSheetParser(spec),
  };
}

export const TEMPLATE_ONLY_MODULES = Object.fromEntries(
  TEMPLATE_ONLY_SLUGS.map((slug) => [slug, buildModule(slug, MODULES[slug])]),
) as Record<TemplateOnlySlug, TemplateOnlyModule>;

/** Lay the module's two seeded imports (history + sample records) down once
 *  per page load, like ensureSeededForLoad. */
export function seedTemplateOnlyImports(slug: TemplateOnlySlug): void {
  seedModuleImports(slug);
}
