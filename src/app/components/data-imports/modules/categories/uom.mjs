/* Provenance: radiant-core-fusion/src/app/data/uom.mjs
 * sha256 1269cd0a8d7654d014a4c67d8e35c6cd13e68bd15a6bb3e6442574d187a31853
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Canonical unit-of-measure table shared by the Categories module.
   Plain ESM so the template generator (Node) and the app (Vite) read ONE
   source. ConfigureCategory.tsx imports everything below; nothing here may
   depend on React or on any TS-only module.
   Each unit declares category, factor against the canonical base of that
   category, abbreviation, and type ("standard" | "custom"). */
export const UOM_CANONICAL = {
  // Length — canonical: Meter
  Meter:        { category: "Length", factor: 1,        abbrev: "M",   type: "standard" },
  Kilometer:    { category: "Length", factor: 1000,     abbrev: "KM",  type: "standard" },
  Centimeter:   { category: "Length", factor: 0.01,     abbrev: "CM",  type: "standard" },
  Millimeter:   { category: "Length", factor: 0.001,    abbrev: "MM",  type: "standard" },
  Inch:         { category: "Length", factor: 0.0254,   abbrev: "IN",  type: "standard" },
  Foot:         { category: "Length", factor: 0.3048,   abbrev: "FT",  type: "standard" },
  Yard:         { category: "Length", factor: 0.9144,   abbrev: "YD",  type: "standard" },
  Mile:         { category: "Length", factor: 1609.344, abbrev: "MI",  type: "standard" },
  // Volume — canonical: Liter
  Liter:        { category: "Volume", factor: 1,           abbrev: "L",     type: "standard" },
  Milliliter:   { category: "Volume", factor: 0.001,       abbrev: "ML",    type: "standard" },
  Gallon:       { category: "Volume", factor: 3.785411784, abbrev: "GAL",   type: "standard" },
  Quart:        { category: "Volume", factor: 0.946352946, abbrev: "QT",    type: "standard" },
  Pint:         { category: "Volume", factor: 0.473176473, abbrev: "PT",    type: "standard" },
  "Cubic Meter":{ category: "Volume", factor: 1000,        abbrev: "M³",    type: "standard" },
  "Cubic Foot": { category: "Volume", factor: 28.3168466,  abbrev: "FT³",   type: "standard" },
  "Fluid Ounce":{ category: "Volume", factor: 0.0295735296,abbrev: "FL OZ", type: "standard" },
  // Mass — canonical: Kilogram
  Kilogram:     { category: "Mass", factor: 1,         abbrev: "KG", type: "standard" },
  Gram:         { category: "Mass", factor: 0.001,     abbrev: "G",  type: "standard" },
  Milligram:    { category: "Mass", factor: 0.000001,  abbrev: "MG", type: "standard" },
  "Metric Ton": { category: "Mass", factor: 1000,      abbrev: "MT", type: "standard" },
  Pound:        { category: "Mass", factor: 0.45359237,abbrev: "LB", type: "standard" },
  Ounce:        { category: "Mass", factor: 0.0283495231, abbrev: "OZ", type: "standard" },
  // Quantity — canonical: Each
  Each:         { category: "Quantity", factor: 1,    abbrev: "EA", type: "standard" },
  Dozen:        { category: "Quantity", factor: 12,   abbrev: "DZ", type: "standard" },
  Hundred:      { category: "Quantity", factor: 100,  abbrev: "C",  type: "standard" },
  Thousand:     { category: "Quantity", factor: 1000, abbrev: "M",  type: "standard" },
  Pair:         { category: "Quantity", factor: 2,    abbrev: "PR", type: "standard" },
  // Area — canonical: Square Meter
  "Square Meter": { category: "Area", factor: 1,           abbrev: "M²",  type: "standard" },
  "Square Foot":  { category: "Area", factor: 0.09290304,  abbrev: "FT²", type: "standard" },
  "Square Yard":  { category: "Area", factor: 0.83612736,  abbrev: "YD²", type: "standard" },
  Acre:           { category: "Area", factor: 4046.8564224,abbrev: "AC",  type: "standard" },
  Hectare:        { category: "Area", factor: 10000,       abbrev: "HA",  type: "standard" },
  // Time — canonical: Second
  Second:       { category: "Time", factor: 1,        abbrev: "S",   type: "standard" },
  Minute:       { category: "Time", factor: 60,       abbrev: "MIN", type: "standard" },
  Hour:         { category: "Time", factor: 3600,     abbrev: "HR",  type: "standard" },
  Day:          { category: "Time", factor: 86400,    abbrev: "D",   type: "standard" },
  Week:         { category: "Time", factor: 604800,   abbrev: "WK",  type: "standard" },
  Month:        { category: "Time", factor: 2629800,  abbrev: "MO",  type: "standard" },
  // Temperature — no linear ratio
  Celsius:      { category: "Temperature", factor: NaN, abbrev: "°C", type: "standard" },
  Fahrenheit:   { category: "Temperature", factor: NaN, abbrev: "°F", type: "standard" },
  Kelvin:       { category: "Temperature", factor: NaN, abbrev: "K",  type: "standard" },
  // Packaging (Custom)
  Box:          { category: "Packaging", factor: NaN, abbrev: "BX",  type: "custom" },
  Case:         { category: "Packaging", factor: NaN, abbrev: "CS",  type: "custom" },
  Carton:       { category: "Packaging", factor: NaN, abbrev: "CT",  type: "custom" },
  Pallet:       { category: "Packaging", factor: NaN, abbrev: "PLT", type: "custom" },
  Pack:         { category: "Packaging", factor: NaN, abbrev: "PK",  type: "custom" },
  Bundle:       { category: "Packaging", factor: NaN, abbrev: "BDL", type: "custom" },
  Roll:         { category: "Packaging", factor: NaN, abbrev: "RL",  type: "custom" },
  Bag:          { category: "Packaging", factor: NaN, abbrev: "BG",  type: "custom" },
  Drum:         { category: "Packaging", factor: NaN, abbrev: "DR",  type: "custom" },
  Container:    { category: "Packaging", factor: NaN, abbrev: "CNT", type: "custom" },
  Tray:         { category: "Packaging", factor: NaN, abbrev: "TY",  type: "custom" },
  Sleeve:       { category: "Packaging", factor: NaN, abbrev: "SLV", type: "custom" },
  Tube:         { category: "Packaging", factor: NaN, abbrev: "TB",  type: "custom" },
  Spool:        { category: "Packaging", factor: NaN, abbrev: "SP",  type: "custom" },
  Ream:         { category: "Packaging", factor: NaN, abbrev: "RM",  type: "custom" },
  Skid:         { category: "Packaging", factor: NaN, abbrev: "SK",  type: "custom" },
  // Custom Business Units
  Set:          { category: "Custom", factor: NaN, abbrev: "SET",  type: "custom" },
  Kit:          { category: "Custom", factor: NaN, abbrev: "KIT",  type: "custom" },
  Assembly:     { category: "Custom", factor: NaN, abbrev: "ASSY", type: "custom" },
  Lot:          { category: "Custom", factor: NaN, abbrev: "LOT",  type: "custom" },
  Batch:        { category: "Custom", factor: NaN, abbrev: "BAT",  type: "custom" },
  Sheet:        { category: "Custom", factor: NaN, abbrev: "SH",   type: "custom" },
  Strip:        { category: "Custom", factor: NaN, abbrev: "STR",  type: "custom" },
  Coil:         { category: "Custom", factor: NaN, abbrev: "COL",  type: "custom" },
  Bar:          { category: "Custom", factor: NaN, abbrev: "BAR",  type: "custom" },
  Piece:        { category: "Custom", factor: NaN, abbrev: "PC",   type: "custom" },
  Unit:         { category: "Custom", factor: NaN, abbrev: "UN",   type: "custom" },
  // Legacy aliases
  Kg:        { category: "Mass",     factor: 1,    abbrev: "KG",   type: "standard" },
  Lb:        { category: "Mass",     factor: 0.45359237, abbrev: "LB", type: "standard" },
  Ton:       { category: "Mass",     factor: 1000, abbrev: "TN",   type: "standard" },
};

export const uomAbbrev = (v) => UOM_CANONICAL[v]?.abbrev ?? v.slice(0, 3).toUpperCase();
export const uomType = (unit) => UOM_CANONICAL[unit]?.type;
export const uomCategory = (unit) => UOM_CANONICAL[unit]?.category;
/** Every selectable unit name, in table order, minus the legacy aliases. */
export const allUnitNames = () => Object.keys(UOM_CANONICAL).filter((k) => k !== "Kg" && k !== "Lb" && k !== "Ton");
export const unitsByCategory = (cat) =>
  Object.entries(UOM_CANONICAL).filter(([, v]) => v.category === cat).map(([k]) => k);
export const UOM_CATEGORIES = ["Length", "Area", "Volume", "Mass", "Quantity", "Time", "Temperature", "Packaging", "Custom"];
export function autoConversionFactor(altUnit, baseUnit) {
  const a = UOM_CANONICAL[altUnit]; const b = UOM_CANONICAL[baseUnit];
  if (!a || !b) return null;
  if (a.category !== b.category) return null;
  if (!isFinite(a.factor) || !isFinite(b.factor) || b.factor === 0) return null;
  return Math.round((a.factor / b.factor) * 10000) / 10000;
}
export const isStandardConversion = (altUnit, baseUnit) => autoConversionFactor(altUnit, baseUnit) != null;
/** Case-insensitive lookup of a unit name as typed in a file; returns the canonical spelling or null. */
export function resolveUnitName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (UOM_CANONICAL[t] && t !== "Kg" && t !== "Lb" && t !== "Ton") return t;
  const lower = t.toLowerCase();
  for (const name of allUnitNames()) {
    if (name.toLowerCase() === lower || UOM_CANONICAL[name].abbrev.toLowerCase() === lower) return name;
  }
  return null;
}
