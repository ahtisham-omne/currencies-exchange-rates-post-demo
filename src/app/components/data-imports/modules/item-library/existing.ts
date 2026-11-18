/* Provenance: snapshot of INITIAL_ITEMS (part number and categories, what buildValidationContext reads)
 * nimble-palette/src/app/context/ItemsContext.tsx sha256 4624aeab7ad2b1681047274b94afd79db8c50c3837a042a135f48112de45d581
 * Taken 2026-09-30 by evaluating the source module. The parity test
 * (src/test/module-import-validation-parity.test.ts) re-reads the live source
 * and fails if this snapshot drifts. */
import type { Item } from "./live";

export const EXISTING_ITEMS: readonly Item[] = [{"partNumber":"FAST-HEX-001","primaryCategory":"Fasteners","additionalCategories":["Screws","Hardware"]},
  {"partNumber":"VALV-BAL-316","primaryCategory":"Plumbing","additionalCategories":["Valves","Industrial"]},
  {"partNumber":"SEAL-OR-012","primaryCategory":"Seals","additionalCategories":["O-Rings","Rubber Goods"]},
  {"partNumber":"TOOL-EM-050","primaryCategory":"Tools","additionalCategories":["Milling","Carbide"]},
  {"partNumber":"MAT-AL-6061","primaryCategory":"Raw Materials","additionalCategories":["Metals","Sheet Stock"]},
  {"partNumber":"MECH-BRG-6204","primaryCategory":"Power Trans","additionalCategories":["Bearings","Mechanical"]},
  {"partNumber":"PNEU-CYL-50","primaryCategory":"Pneumatics","additionalCategories":["Cylinders","Automation"]},
  {"partNumber":"ELEC-CB-20A","primaryCategory":"Electrical","additionalCategories":["Circuit Protection","DIN Rail"]},
  {"partNumber":"TEST-DMM-87V","primaryCategory":"Test Equip","additionalCategories":["Multimeters","Tools"]},
  {"partNumber":"ASM-PUMP-01","primaryCategory":"Assemblies","additionalCategories":["Hydraulics","Custom"]},
  {"partNumber":"HYD-HOSE-3T","primaryCategory":"Hydraulics","additionalCategories":["Hoses","Fluid Power"]},
  {"partNumber":"GASKET-CU-150","primaryCategory":"Seals","additionalCategories":["Gaskets","Flange"]},
  {"partNumber":"MOTOR-AC-5HP","primaryCategory":"Power Trans","additionalCategories":["Motors","Electrical"]},
  {"partNumber":"WIRE-THHN-12","primaryCategory":"Electrical","additionalCategories":["Wire","Cable"]},
  {"partNumber":"FILTER-HYD-10","primaryCategory":"Hydraulics","additionalCategories":["Filtration","Maintenance"]},
  {"partNumber":"BOLT-HEX-M10","primaryCategory":"Fasteners","additionalCategories":["Bolts","Metric"]},
  {"partNumber":"PLC-S7-1200","primaryCategory":"Automation","additionalCategories":["PLC","Controls"]},
  {"partNumber":"LUBE-GR-EP2","primaryCategory":"Lubricants","additionalCategories":["Grease","MRO"]},
  {"partNumber":"DRILL-HSS-25","primaryCategory":"Tools","additionalCategories":["Drill Bits","Cutting"]},
  {"partNumber":"STEEL-RD-1018","primaryCategory":"Raw Materials","additionalCategories":["Steel","Bar Stock"]},
  {"partNumber":"BELT-V-A48","primaryCategory":"Power Trans","additionalCategories":["Belts","Drives"]},
  {"partNumber":"SAFETY-GLV-L","primaryCategory":"Safety","additionalCategories":["PPE","Gloves"]}];
