/* Unit editors for the Categories import, mirroring radiant-core-fusion
 * ConfigureCategory: the Base Unit of Measure searchable select (each unit
 * with its Standard / Custom pill) and the Alternative Units builder (base
 * unit anchor, category-then-unit cascading picker, conversion factor locked
 * to the company UOM table when it has one, Add Unit, empty state). The
 * builder reads the row's own Base Unit of Measure and commits
 * "Unit=factor|Unit=factor", the vocabulary the validator parses. */

import { useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, Info, Layers, Lock, Plus, Search, Trash2 } from "lucide-react";
import {
  UOM_CANONICAL,
  UOM_CATEGORIES,
  allUnitNames,
  autoConversionFactor,
  isStandardConversion,
  resolveUnitName,
  unitsByCategory,
  uomAbbrev,
  uomCategory,
  uomType,
} from "../../categories/uom.mjs";
import type { SpecialCellEditorProps } from "../registry";
import { CellEditorPopover, FIELD_HINT_STYLE, FIELD_LABEL_STYLE, PanelFooter, tabDir, useFinalize } from "./shell";

function UomTypePill({ unit }: { unit: string }) {
  const t = uomType(unit);
  if (!t) return null;
  const isStd = t === "standard";
  return (
    <span
      className={isStd ? "bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium" : "bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium"}
      style={{ lineHeight: 1.2 }}
    >
      {isStd ? "Standard" : "Custom"}
    </span>
  );
}

function AbbrevTile({ unit, active = true }: { unit: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 6, background: active ? "#EDF4FF" : "#F1F5F9" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#0A77FF" : "#94A3B8", letterSpacing: 0.4 }}>{unit ? uomAbbrev(unit) : "-"}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Base Unit of Measure: searchable select with type pills
   ════════════════════════════════════════════════════════════ */
export function BaseUomEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const current = resolveUnitName(initialValue);
  const [search, setSearch] = useState("");
  const options = useMemo(() => allUnitNames(), []);
  const filtered = options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()));
  const [active, setActive] = useState(() => Math.max(0, current ? options.indexOf(current) : 0));
  const listRef = useRef<HTMLDivElement>(null);
  const activeIdx = Math.min(active, Math.max(0, filtered.length - 1));

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    const next = (activeIdx + delta + filtered.length) % filtered.length;
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <CellEditorPopover
      display={current ?? (initialValue.trim() || null)}
      placeholder="Select UOM..."
      width={280}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Enter") { e.preventDefault(); if (filtered[activeIdx]) commit(filtered[activeIdx]); }
        else if (e.key === "Tab") { e.preventDefault(); if (filtered[activeIdx]) commit(filtered[activeIdx], tabDir(e)); else cancel(); }
      }}
    >
      <div className="p-2" style={{ borderBottom: "0.75px solid #E2E8F0" }}>
        <div className="relative">
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9CA3AF" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActive(0); }}
            placeholder="Search..."
            className="w-full outline-none bg-transparent pl-8"
            style={{ height: 32, fontSize: 12 }}
            autoFocus
          />
        </div>
      </div>
      <div ref={listRef} style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.map((opt, i) => (
          <div
            key={opt}
            data-idx={i}
            onClick={() => commit(opt)}
            onMouseEnter={() => setActive(i)}
            className="flex items-center gap-2 px-3 cursor-pointer transition-colors"
            style={{ height: 36, fontSize: 13, color: "#0F172A", background: i === activeIdx ? "#F1F5F9" : "transparent" }}
          >
            <span className="flex-1">{opt}</span>
            <UomTypePill unit={opt} />
            {current === opt && <Check style={{ width: 14, height: 14, color: "#0A77FF" }} />}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: "#71717A" }}>No results</div>
        )}
      </div>
    </CellEditorPopover>
  );
}

/* ════════════════════════════════════════════════════════════
   Alternative Units: the pairing builder
   ════════════════════════════════════════════════════════════ */
interface AltDraft {
  id: string;
  /** Canonical unit, or "" when none is picked yet. */
  unit: string;
  /** The file's spelling when it did not resolve to a unit (kept until replaced). */
  rawUnit: string;
  factor: string;
}

let draftSeq = 0;
const nextId = () => `au-${++draftSeq}`;

function parseDrafts(raw: string): AltDraft[] {
  return String(raw ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf("=");
      const unitText = (eq < 0 ? entry : entry.slice(0, eq)).trim();
      const factor = eq < 0 ? "" : entry.slice(eq + 1).trim();
      const unit = resolveUnitName(unitText) ?? "";
      return { id: nextId(), unit, rawUnit: unit ? "" : unitText, factor };
    });
}

function serialize(drafts: AltDraft[]): string {
  return drafts
    .map((d) => {
      const unit = d.unit || d.rawUnit;
      if (!unit) return "";
      return `${unit}=${d.factor.trim()}`;
    })
    .filter(Boolean)
    .join("|");
}

function AltUomCascadingPicker({
  value,
  rawValue,
  onChange,
  baseUom,
  excludeUnits,
}: {
  value: string;
  rawValue: string;
  onChange: (unit: string) => void;
  baseUom: string;
  excludeUnits: string[];
}) {
  const [open, setOpen] = useState(!value && !rawValue);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const excluded = new Set(excludeUnits);
  const baseCategory = uomCategory(baseUom);

  const catCounts: Record<string, number> = {};
  UOM_CATEGORIES.forEach((c) => {
    catCounts[c] = unitsByCategory(c).filter((u) => u !== baseUom && !excluded.has(u)).length;
  });
  const trimmed = search.trim().toLowerCase();
  const crossUnitMatches =
    !activeCat && trimmed
      ? Object.keys(UOM_CANONICAL)
          .filter((u) => u !== baseUom && !excluded.has(u) && uomCategory(u) !== baseCategory)
          .filter((u) => u.toLowerCase().includes(trimmed))
      : [];
  const filteredCats = UOM_CATEGORIES.filter((c) => (!trimmed ? true : c.toLowerCase().includes(trimmed)));
  const unitsInActive = activeCat ? unitsByCategory(activeCat).filter((u) => u !== baseUom && !excluded.has(u)) : [];
  const filteredUnits = unitsInActive.filter((u) => u.toLowerCase().includes(trimmed));

  const reset = () => { setActiveCat(null); setSearch(""); };
  const pick = (unit: string) => { onChange(unit); setOpen(false); reset(); };

  const unitRow = (u: string, withCheck: boolean) => (
    <div
      key={u}
      onClick={() => pick(u)}
      className="flex items-center gap-2 px-2 cursor-pointer hover:bg-[#F1F5F9]"
      style={{ height: 36, fontSize: 13, color: "#0F172A" }}
    >
      <AbbrevTile unit={u} />
      <span className="flex-1">{u}</span>
      <UomTypePill unit={u} />
      {withCheck && value === u && <Check style={{ width: 14, height: 14, color: "#0A77FF" }} />}
    </div>
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full hover:border-[#BFDBFE] transition-colors"
          style={{
            background: "#F8FAFC",
            border: `1px solid ${rawValue ? "#FCA5A5" : "#E2E8F0"}`,
            borderRadius: 10,
            padding: "6px 8px",
            cursor: "pointer",
            textAlign: "left",
            height: 40,
          }}
        >
          <AbbrevTile unit={value} active={!!value} />
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 12, fontWeight: 700, color: value ? "#0F172A" : rawValue ? "#B91C1C" : "#94A3B8", lineHeight: 1.2 }}>
              {value || rawValue || "Select unit"}
            </div>
          </div>
          <ChevronDown style={{ width: 12, height: 12, color: "#94A3B8" }} className="shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          align="start"
          sideOffset={4}
          collisionPadding={8}
          /* Keys typed in the unit search stay here: React bubbles portal
             events to the builder, whose Enter would save the cell. */
          onKeyDown={(e) => e.stopPropagation()}
          className="p-0 z-[330] bg-white outline-none"
          style={{ border: "0.75px solid #E2E8F0", borderRadius: 10, boxShadow: "0 4px 24px -4px rgba(0,0,0,0.15)", overflow: "hidden", width: 260 }}
        >
          {activeCat && (
            <div
              className="flex items-center gap-2 px-2"
              style={{ height: 36, borderBottom: "0.75px solid #E2E8F0", background: "#FAFBFC", cursor: "pointer" }}
              onClick={() => { setActiveCat(null); setSearch(""); }}
            >
              <ChevronLeft style={{ width: 14, height: 14, color: "#475569" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{activeCat}</span>
            </div>
          )}
          <div className="p-2" style={{ borderBottom: "0.75px solid #E2E8F0" }}>
            <div className="relative">
              <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeCat ? "Search units..." : "Search categories or units..."}
                className="w-full outline-none bg-transparent pl-8"
                style={{ height: 32, fontSize: 12 }}
                autoFocus
              />
            </div>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {!activeCat && (
              <>
                {crossUnitMatches.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase", padding: "6px 10px 2px" }}>Units</div>
                    {crossUnitMatches.map((u) => unitRow(u, false))}
                    <div style={{ height: 1, background: "#E2E8F0", margin: "4px 0" }} />
                  </div>
                )}
                {filteredCats.length === 0 && crossUnitMatches.length === 0 && (
                  <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: "#71717A" }}>No results</div>
                )}
                {filteredCats.map((cat) => {
                  const isBaseCat = cat === baseCategory;
                  return (
                    <div
                      key={cat}
                      onClick={() => { if (!isBaseCat) { setActiveCat(cat); setSearch(""); } }}
                      className={`flex items-center gap-2 px-3 ${isBaseCat ? "cursor-not-allowed" : "cursor-pointer hover:bg-[#F1F5F9]"}`}
                      style={{ height: 38, fontSize: 13, color: isBaseCat ? "#CBD5E1" : "#0F172A", opacity: isBaseCat ? 0.7 : 1 }}
                      title={isBaseCat ? "Same as base unit category, not available" : undefined}
                    >
                      <span className="flex-1" style={{ fontWeight: 500 }}>{cat}</span>
                      {isBaseCat ? (
                        <span style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>Same as base unit category</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>({catCounts[cat] ?? 0})</span>
                          <ChevronRight style={{ width: 14, height: 14, color: "#94A3B8" }} />
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {activeCat && (
              <>
                {filteredUnits.length === 0 && (
                  <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: "#71717A" }}>No units</div>
                )}
                {filteredUnits.map((u) => unitRow(u, true))}
              </>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function AlternativeUnitsEditor({ initialValue, onCommit, onCancel, row }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const baseUom = resolveUnitName(row.uom ?? "") ?? "Each";
  const baseCat = uomCategory(baseUom) || "";
  const [drafts, setDrafts] = useState<AltDraft[]>(() => parseDrafts(initialValue));

  const update = (id: string, patch: Partial<AltDraft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const addUnit = () => setDrafts((ds) => [...ds, { id: nextId(), unit: "", rawUnit: "", factor: "" }]);
  const done = (dir?: "right" | "left") => commit(serialize(drafts), dir);

  const pairCount = drafts.filter((d) => d.unit).length;

  return (
    <CellEditorPopover
      display={initialValue.trim() || null}
      placeholder="- Add units -"
      width={640}
      onDismiss={() => done()}
      onEscape={cancel}
      onKeyDown={(e) => {
        /* Enter saves from anywhere in the builder; Tab keeps moving between
           the builder's own fields. */
        if (e.key === "Enter") { e.preventDefault(); done(); }
      }}
    >
      <div className="px-3.5 pt-3 pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span style={FIELD_LABEL_STYLE}>Alternative Units</span>
            <span title="Define how this item is bought or sold in different units. For example, if you purchase in Boxes but stock in Each, enter how many Each fit in one Box.">
              <Info style={{ width: 12, height: 12, color: "#94A3B8" }} />
            </span>
          </div>
          <button
            type="button"
            onClick={addUnit}
            className="inline-flex items-center gap-1.5 px-3 hover:bg-[#EDF4FF] transition-colors shrink-0 cursor-pointer"
            style={{ height: 32, borderRadius: 8, border: "1px solid #BFDBFE", fontSize: 12, fontWeight: 500, color: "#0A77FF", background: "#F8FBFF" }}
          >
            <Plus style={{ width: 13, height: 13 }} /> Add Unit
          </button>
        </div>
        <span className="block" style={{ ...FIELD_HINT_STYLE, marginTop: 2 }}>
          Defined relative to the base unit ({baseUom}). Alternatives must come from a different unit category.
        </span>
      </div>

      <div className="px-3.5 pb-3 pt-2 overflow-y-auto" style={{ maxHeight: 380 }}>
        {drafts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2.5 px-4"
            style={{ minHeight: 132, borderRadius: 10, border: "1.5px dashed #CBD5E1", background: "linear-gradient(180deg, #FAFBFC 0%, #F4F6F8 100%)" }}
          >
            <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <Layers style={{ width: 16, height: 16, color: "#94A3B8" }} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#475569", lineHeight: 1.3 }}>No alternative units added</span>
              <span style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 1.4, maxWidth: 360 }}>
                Each alternative is converted back to <strong style={{ color: "#475569", fontWeight: 600 }}>{baseUom}</strong>. Add units from other categories (like Cases, Pallets, or Meters) to define item-specific conversions.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((au) => {
              const used = drafts.filter((d) => d.id !== au.id && d.unit).map((d) => d.unit);
              const isStandard = !!au.unit && isStandardConversion(au.unit, baseUom);
              const cfNum = parseFloat(au.factor);
              const cfValid = Number.isFinite(cfNum) && cfNum > 0;
              const oneToOneWarn = cfValid && cfNum === 1 && au.unit && au.unit !== baseUom;
              const altCat = au.unit ? uomCategory(au.unit) || "" : "";
              const sharesBaseCat = !!au.unit && !!baseCat && altCat === baseCat;
              const isBase = au.unit === baseUom;
              return (
                <div key={au.id} className="relative flex flex-col gap-1 p-2 rounded-lg border border-[#E2E8F0] bg-white">
                  <div className="flex items-start gap-3 px-1 py-1">
                    <div className="min-w-0" style={{ flex: "0 0 52%" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 3 }}>Unit pairing</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center gap-2 shrink-0"
                          style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "6px 10px 6px 8px", height: 40 }}
                          title={`Base unit: ${baseUom}${baseCat ? ` (${baseCat})` : ""}`}
                        >
                          <div className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 6, background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 0.4 }}>{uomAbbrev(baseUom)}</span>
                          </div>
                          <div className="min-w-0">
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>{baseUom}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.2, marginTop: 1 }}>Base unit</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-center shrink-0" style={{ width: 18, height: 40 }}>
                          <ArrowLeftRight style={{ width: 12, height: 12, color: "#CBD5E1" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <AltUomCascadingPicker
                            value={au.unit}
                            rawValue={au.rawUnit}
                            baseUom={baseUom}
                            excludeUnits={used}
                            onChange={(unit) => {
                              const auto = autoConversionFactor(unit, baseUom);
                              update(au.id, { unit, rawUnit: "", factor: auto != null ? String(auto) : au.factor });
                            }}
                          />
                        </div>
                      </div>
                      {altCat && (
                        <div className="flex items-center gap-1.5" style={{ marginTop: 4, paddingLeft: 2 }}>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>{altCat}</span>
                          <UomTypePill unit={au.unit} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 3 }}>Equals (in base unit)</div>
                      <div className="flex items-center gap-2.5" style={{ height: 40 }}>
                        {!au.unit ? (
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>Select a unit to define the conversion rate</span>
                        ) : (
                          <>
                            <span className="whitespace-nowrap" style={{ fontSize: 12, color: "#64748B" }}>1 {au.unit} =</span>
                            {isStandard ? (
                              <div
                                className="flex items-center gap-1.5"
                                style={{ height: 36, padding: "0 10px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #E2E8F0", minWidth: 120 }}
                                title="Locked, defined in the company UOM conversion table"
                              >
                                <Lock style={{ width: 11, height: 11, color: "#94A3B8" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{au.factor}</span>
                                <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: "auto" }}>{baseUom}</span>
                              </div>
                            ) : (
                              <div className="relative" style={{ width: 130 }}>
                                <input
                                  type="number"
                                  value={au.factor}
                                  onChange={(e) => update(au.id, { factor: e.target.value })}
                                  className="w-full rounded-md border outline-none focus:border-[#93C5FD]"
                                  style={{ height: 36, fontSize: 13, color: "#0F172A", paddingLeft: 8, paddingRight: 56, background: "#FFFFFF", borderColor: au.factor && !cfValid ? "#FCA5A5" : "#E2E8F0" }}
                                  placeholder="0"
                                />
                                <span className="absolute pointer-events-none whitespace-nowrap" style={{ right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94A3B8" }}>
                                  {baseUom}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== au.id))}
                      className="flex items-center justify-center text-slate-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0 cursor-pointer"
                      style={{ width: 24, height: 40, marginTop: 18 }}
                      title="Remove"
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                  {au.rawUnit && (
                    <div style={{ fontSize: 11, color: "#B91C1C", paddingLeft: 4 }}>
                      "{au.rawUnit}" is not a unit Omne knows. Pick a unit to replace it.
                    </div>
                  )}
                  {(sharesBaseCat || isBase) && (
                    <div style={{ fontSize: 11, color: "#B91C1C", paddingLeft: 4 }}>
                      This alternative shares a category with the base unit. Remove or change it.
                    </div>
                  )}
                  {au.unit && !cfValid && !isStandard && (
                    <div style={{ fontSize: 11, color: "#B91C1C", paddingLeft: 4 }}>Enter a conversion factor above 0.</div>
                  )}
                  {au.unit && isStandard && !sharesBaseCat && (
                    <div style={{ fontSize: 11, color: "#475569", paddingLeft: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Lock style={{ width: 10, height: 10, color: "#94A3B8" }} />
                      Locked, defined in the company UOM conversion table.
                    </div>
                  )}
                  {au.unit && !isStandard && !sharesBaseCat && cfValid && (
                    <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>
                      Custom conversion, applies to this category only and won't affect the company UOM table.
                    </div>
                  )}
                  {oneToOneWarn && !isStandard && (
                    <div style={{ fontSize: 11, color: "#B45309", paddingLeft: 4 }}>
                      1 {au.unit} = 1 {baseUom}. Are you sure? These units typically have different conversion rates.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <PanelFooter left={`${pairCount} ${pairCount === 1 ? "unit" : "units"}`} onDone={() => done()} />
    </CellEditorPopover>
  );
}
