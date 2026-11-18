/* Free-form Item Library editors whose home control is richer than a text
 * box: the numeric steppers with their unit card, the Acceptable Variance scale, the
 * Alternative Units pairing builder and the Custom Price Per Unit tiers.
 * Each serialises back to the file notation the validator parses:
 *   alternativeUnits   Box=4|Pallet=48
 *   pricing            1250.00 Each|4800.00 Box */

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronRight, Layers, Minus, Plus, Trash2, X } from "lucide-react";
import type { SpecialCellEditorProps } from "../registry";
import { splitPipe } from "../../item-library/helpers";
import { LIVE_PRICE_UNITS, LIVE_UNIT_NAMES, unitOptionGroups } from "../../item-library/spec";
import { uomCategory } from "../../item-library/live";
import { CellTrigger, EditorPopover, PanelFooter, PanelHeader, UnitBadge, UomTypePill, tabDir, useFinalize } from "./shell";

const INPUT_CLASS =
  "w-full rounded-md border border-[#E2E8F0] bg-white outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#0A77FF]/15 transition-colors";

function canonicalUnit(raw: string, options: readonly string[]): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return options.find((o) => o.toLowerCase() === v) ?? null;
}

/* ═══ Tags: chip input, Enter or comma adds, 30 characters each ═══ */

export function StepperEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const [value, setValue] = useState(p.initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const n = Number.parseFloat(value);
  const step = (d: number) => {
    const base = Number.isFinite(n) ? n : 0;
    setValue(String(Math.max(0, Math.round((base + d) * 1000) / 1000)));
    inputRef.current?.focus();
  };
  const card = unitCardFor(p);
  const isShelf = p.col.key === "shelfLifeValue";
  return (
    <EditorPopover
      trigger={<CellTrigger placeholder="0">{value || null}</CellTrigger>}
      width={290}
      autoFocusContent={false}
      onDismiss={() => finalize("commit", value.trim())}
      onEscape={() => finalize("cancel")}
    >
      <PanelHeader title={p.col.label} hint={p.col.description} />
      <div className="p-3">
        <div className="flex items-center" style={{ borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden", height: 40, backgroundColor: "#FFFFFF" }}>
          <button type="button" onClick={() => step(-1)} aria-label="Decrease" className="flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80" style={{ width: 40, height: "100%", borderRight: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}>
            <Minus style={{ width: 14, height: 14, color: "#64748B" }} />
          </button>
          <input
            ref={inputRef}
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              const dir = tabDir(e);
              if (dir) {
                e.preventDefault();
                finalize("commit", value.trim(), dir);
              } else if (e.key === "Enter") {
                e.preventDefault();
                finalize("commit", value.trim());
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                step(1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                step(-1);
              }
            }}
            placeholder="0"
            className="flex-1 min-w-0 bg-white outline-none text-center"
            style={{ height: "100%", fontSize: 13, fontWeight: 500, color: "#0F172A" }}
          />
          <button type="button" onClick={() => step(1)} aria-label="Increase" className="flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80" style={{ width: 40, height: "100%", borderLeft: "1px solid #E2E8F0", backgroundColor: "#F1F5F9" }}>
            <Plus style={{ width: 14, height: 14, color: "#64748B" }} />
          </button>
        </div>
        {value.trim() !== "" && !Number.isFinite(Number(value)) && (
          <div className="mt-1.5" style={{ fontSize: 11.5, color: "#DC2626" }}>Enter a number, such as 12.</div>
        )}
        {card && (
          <div className="mt-2.5 flex items-center gap-3" style={{ borderRadius: 12, border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", padding: 10 }}>
            {isShelf ? (
              <span className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 6, background: "#EDF4FF", fontSize: 10, fontWeight: 700, color: "#0A77FF" }}>
                {card.unit.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <UnitBadge unit={card.unit} />
            )}
            <span className="min-w-0">
              <span className="block" style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{card.unit}</span>
              <span className="block" style={{ fontSize: 11, color: "#94A3B8" }}>{card.sub}</span>
            </span>
          </div>
        )}
      </div>
    </EditorPopover>
  );
}

/* ═══ Acceptable Variance (%): number, %, Tight to Loose scale ═══ */

export function VarianceEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const [value, setValue] = useState(p.initialValue);
  const n = Number.parseFloat(value || "0");
  const pct = Math.min(100, Math.max(0, (Number.isFinite(n) ? n : 0) * 5));
  const ring = n <= 5 ? "#22C55E" : n <= 10 ? "#F59E0B" : "#EF4444";
  return (
    <EditorPopover
      trigger={<CellTrigger placeholder="0">{value ? `${value}%` : null}</CellTrigger>}
      width={300}
      autoFocusContent={false}
      onDismiss={() => finalize("commit", value.trim())}
      onEscape={() => finalize("cancel")}
    >
      <PanelHeader title="Acceptable Variance (%)" hint="Maximum allowed percentage difference (±) before requiring approval." />
      <div className="p-3">
        <div className="flex items-center gap-3">
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              const dir = tabDir(e);
              if (dir) {
                e.preventDefault();
                finalize("commit", value.trim(), dir);
              } else if (e.key === "Enter") {
                e.preventDefault();
                finalize("commit", value.trim());
              }
            }}
            placeholder="0"
            className={`${INPUT_CLASS} px-3`}
            style={{ height: 40, fontSize: 13, width: 120, color: "#0F172A" }}
          />
          <span style={{ fontSize: 13, color: "#71717A" }}>%</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span style={{ fontSize: 10, fontWeight: 600, color: "#22C55E" }}>Tight</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "linear-gradient(90deg, #22C55E 0%, #F59E0B 50%, #EF4444 100%)", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: -3,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "white",
                border: `2px solid ${ring}`,
                transform: "translateX(-50%)",
                transition: "left 0.3s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#EF4444" }}>Loose</span>
        </div>
      </div>
    </EditorPopover>
  );
}

/* ═══ Alternative Units: base anchor ⇄ unit, "1 X =" factor ═══ */

interface AltRow {
  id: number;
  unit: string;
  factor: string;
}

function parseAltUnits(value: string): { rows: AltRow[]; unreadable: string[] } {
  const rows: AltRow[] = [];
  const unreadable: string[] = [];
  let id = 1;
  for (const part of splitPipe(value)) {
    const m = part.match(/^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
    const unit = m ? canonicalUnit(m[1], LIVE_UNIT_NAMES) : null;
    if (!m || !unit) {
      unreadable.push(part);
      continue;
    }
    rows.push({ id: id++, unit, factor: m[2] });
  }
  return { rows, unreadable };
}

export function AlternativeUnitsEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const parsed = useMemo(() => parseAltUnits(p.initialValue), [p.initialValue]);
  const [rows, setRows] = useState<AltRow[]>(parsed.rows);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [pickerCat, setPickerCat] = useState<string | null>(null);
  const nextId = useRef(parsed.rows.length + 1);
  const base = canonicalUnit(p.row.unit ?? "", LIVE_UNIT_NAMES) ?? "Each";
  const baseCat = uomCategory(base) ?? "";
  const groups = useMemo(() => unitOptionGroups(), []);

  const serialise = () =>
    rows
      .filter((r) => r.unit && Number.parseFloat(r.factor) > 0)
      .map((r) => `${r.unit}=${r.factor.trim()}`)
      .join("|");
  const incomplete = rows.filter((r) => !r.unit || !(Number.parseFloat(r.factor) > 0)).length;
  const update = (id: number, patch: Partial<AltRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <EditorPopover
      trigger={<CellTrigger>{rows.length ? rows.map((r) => `${r.unit || "?"}=${r.factor || "?"}`).join(" · ") : p.initialValue || null}</CellTrigger>}
      width={560}
      onDismiss={() => finalize("commit", serialise())}
      onEscape={() => finalize("cancel")}
      onKeyDown={(e) => {
        const dir = tabDir(e);
        if (dir && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          finalize("commit", serialise(), dir);
        }
      }}
    >
      <div className="px-3.5 pt-3 pb-2 border-b border-[#F1F5F9] flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Alternative Units</div>
          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2, lineHeight: 1.4 }}>
            Defined relative to the base unit. Alternatives must come from a different unit category.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = nextId.current++;
            setRows((rs) => [...rs, { id, unit: "", factor: "" }]);
            setOpenPicker(id);
            setPickerCat(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 shrink-0 cursor-pointer hover:bg-[#EDF4FF] transition-colors"
          style={{ height: 32, borderRadius: 8, border: "1px solid #BFDBFE", fontSize: 12, fontWeight: 500, color: "#0A77FF", background: "#F8FBFF" }}
        >
          <Plus style={{ width: 13, height: 13 }} /> Add Unit
        </button>
      </div>

      {parsed.unreadable.length > 0 && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg shrink-0" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11.5, color: "#B91C1C", lineHeight: 1.4 }}>
          Could not be read, so it is dropped when you save: {parsed.unreadable.join(", ")}. Add it again below.
        </div>
      )}

      <div className="p-3 overflow-y-auto flex flex-col gap-2" style={{ maxHeight: 380 }}>
        {rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2.5 px-4 text-center"
            style={{ minHeight: 132, borderRadius: 10, border: "1.5px dashed #CBD5E1", background: "linear-gradient(180deg, #FAFBFC 0%, #F4F6F8 100%)" }}
          >
            <span className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <Layers style={{ width: 16, height: 16, color: "#94A3B8" }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>No alternative units added</span>
            <span style={{ fontSize: 11, color: "#94A3B8", maxWidth: 360, lineHeight: 1.4 }}>
              Each alternative is converted back to <strong style={{ color: "#475569", fontWeight: 600 }}>{base}</strong>. Add units from other categories (like Cases, Pallets, or Meters) to define item-specific conversions.
            </span>
          </div>
        ) : (
          rows.map((r) => {
            const used = new Set(rows.filter((x) => x.id !== r.id).map((x) => x.unit));
            const altCat = r.unit ? uomCategory(r.unit) ?? "" : "";
            const f = Number.parseFloat(r.factor);
            const open = openPicker === r.id;
            return (
              <div key={r.id} className="flex flex-col gap-1 p-2 rounded-lg border border-[#E2E8F0] bg-white">
                <div className="flex items-start gap-3 px-1 py-1">
                  <div className="min-w-0" style={{ flex: "0 0 54%" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 3 }}>Unit pairing</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 shrink-0" style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "6px 10px 6px 8px", height: 40 }} title={`Base unit, ${base}${baseCat ? ` (${baseCat})` : ""}`}>
                        <UnitBadge unit={base} muted />
                        <span className="min-w-0">
                          <span className="block" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>{base}</span>
                          <span className="block" style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.2, marginTop: 1 }}>Base unit</span>
                        </span>
                      </div>
                      <ArrowLeftRight className="shrink-0" style={{ width: 12, height: 12, color: "#CBD5E1" }} />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPicker(open ? null : r.id);
                          setPickerCat(null);
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 hover:border-[#BFDBFE] transition-colors cursor-pointer text-left"
                        style={{ background: "#F8FAFC", border: `1px solid ${open ? "#93C5FD" : "#E2E8F0"}`, borderRadius: 10, padding: "6px 8px", height: 40 }}
                      >
                        <UnitBadge unit={r.unit} />
                        <span className="flex-1 min-w-0 truncate" style={{ fontSize: 12, fontWeight: 700, color: r.unit ? "#0F172A" : "#94A3B8" }}>{r.unit || "Select unit"}</span>
                        <ChevronDown className="shrink-0" style={{ width: 12, height: 12, color: "#94A3B8" }} />
                      </button>
                    </div>
                    {altCat && (
                      <div className="flex items-center gap-1.5" style={{ marginTop: 4, paddingLeft: 2 }}>
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>{altCat}</span>
                        <UomTypePill unit={r.unit} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 3 }}>Equals (in base unit)</div>
                    <div className="flex items-center gap-2.5" style={{ height: 40 }}>
                      {!r.unit ? (
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>Select a unit to define the conversion rate</span>
                      ) : (
                        <>
                          <span className="whitespace-nowrap" style={{ fontSize: 12, color: "#64748B" }}>1 {r.unit} =</span>
                          <div className="relative flex-1 min-w-0">
                            <input
                              inputMode="decimal"
                              value={r.factor}
                              onChange={(e) => update(r.id, { factor: e.target.value })}
                              onKeyDown={(e) => {
                                const dir = tabDir(e);
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  finalize("commit", serialise());
                                } else if (dir) {
                                  e.preventDefault();
                                  finalize("commit", serialise(), dir);
                                }
                              }}
                              autoFocus={!r.factor}
                              placeholder="0"
                              className={`${INPUT_CLASS} pl-2`}
                              style={{ height: 36, fontSize: 13, color: "#0F172A", paddingRight: 52 }}
                            />
                            <span className="absolute pointer-events-none whitespace-nowrap" style={{ right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94A3B8" }}>
                              {base}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    title="Remove"
                    className="flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0 cursor-pointer"
                    style={{ width: 24, height: 40, marginTop: 18 }}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>

                {open && (
                  <div className="mx-1 mb-1 rounded-lg border border-[#E2E8F0] overflow-hidden">
                    {!pickerCat ? (
                      <div className="max-h-[210px] overflow-y-auto py-1">
                        {groups.map((g) => {
                          const same = g.label === baseCat;
                          return (
                            <button
                              key={g.label}
                              type="button"
                              disabled={same}
                              onClick={() => setPickerCat(g.label)}
                              className="flex items-center justify-between w-full px-3 transition-colors text-left disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:bg-[#F8FAFC]"
                              style={{ height: 34, fontSize: 12.5, color: same ? "#CBD5E1" : "#0F172A" }}
                            >
                              <span>{g.label}</span>
                              <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#94A3B8" }}>
                                {same ? "Base unit's category" : `${g.options.length} units`}
                                {!same && <ChevronRight style={{ width: 12, height: 12 }} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <button type="button" onClick={() => setPickerCat(null)} className="flex items-center gap-1 w-full px-3 border-b border-[#F1F5F9] cursor-pointer hover:bg-[#F8FAFC]" style={{ height: 32, fontSize: 11.5, fontWeight: 600, color: "#0A77FF" }}>
                          ‹ {pickerCat}
                        </button>
                        <div className="max-h-[180px] overflow-y-auto py-1">
                          {(groups.find((g) => g.label === pickerCat)?.options ?? [])
                            .filter((u) => !used.has(u))
                            .map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => {
                                  update(r.id, { unit: u });
                                  setOpenPicker(null);
                                  setPickerCat(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                                style={{ height: 36, fontSize: 13, color: "#0F172A" }}
                              >
                                <UnitBadge unit={u} />
                                <span className="flex-1 text-left">{u}</span>
                                <UomTypePill unit={u} />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {r.unit && Number.isFinite(f) && f > 0 && (
                  <div style={{ fontSize: 11, color: f === 1 ? "#B45309" : "#94A3B8", paddingLeft: 4 }}>
                    {f === 1
                      ? `1 ${r.unit} = 1 ${base}, are you sure? These units typically have different conversion rates.`
                      : "Custom conversion, applies to this item only and won't affect the company UOM table."}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <PanelFooter
        left={incomplete > 0 ? `${incomplete} row${incomplete > 1 ? "s" : ""} without a unit and factor won't be saved` : `${rows.length} unit${rows.length === 1 ? "" : "s"}`}
        onDone={() => finalize("commit", serialise())}
      />
    </EditorPopover>
  );
}

/* ═══ Custom Price Per Unit: $ price + unit tiers ═══ */

interface PriceRow {
  id: number;
  price: string;
  unit: string;
}

export function PricingEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const parsed = useMemo(() => {
    const rows: PriceRow[] = [];
    const unreadable: string[] = [];
    let id = 1;
    for (const tier of splitPipe(p.initialValue)) {
      const m = tier.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      const unit = m ? canonicalUnit(m[2], LIVE_PRICE_UNITS) : null;
      if (!m || !unit) {
        unreadable.push(tier);
        continue;
      }
      rows.push({ id: id++, price: m[1], unit });
    }
    return { rows, unreadable };
  }, [p.initialValue]);
  const [rows, setRows] = useState<PriceRow[]>(parsed.rows);
  const [unitOpen, setUnitOpen] = useState<number | null>(null);
  const nextId = useRef(parsed.rows.length + 1);
  const valid = (r: PriceRow) => /^\d+(\.\d+)?$/.test(r.price.trim()) && !!r.unit;
  const serialise = () => rows.filter(valid).map((r) => `${r.price.trim()} ${r.unit}`).join("|");
  const update = (id: number, patch: Partial<PriceRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const scope = (p.row.sellingScope ?? "").trim().toLowerCase();
  const incomplete = rows.filter((r) => !valid(r)).length;

  return (
    <EditorPopover
      trigger={<CellTrigger>{rows.length ? rows.map((r) => `$${r.price || "?"} ${r.unit || "?"}`).join(" · ") : p.initialValue || null}</CellTrigger>}
      width={380}
      onDismiss={() => finalize("commit", serialise())}
      onEscape={() => finalize("cancel")}
      onKeyDown={(e) => {
        const dir = tabDir(e);
        if (dir && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          finalize("commit", serialise(), dir);
        }
      }}
    >
      <PanelHeader title="Custom Price Per Unit" hint="Set a default selling price per unit. Defined prices apply to every partner when selling globally." />
      {scope === "specific" && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg shrink-0" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 11.5, color: "#92400E", lineHeight: 1.4 }}>
          Custom prices apply when Selling Scope is All.
        </div>
      )}
      {parsed.unreadable.length > 0 && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg shrink-0" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11.5, color: "#B91C1C", lineHeight: 1.4 }}>
          Could not be read, so it is dropped when you save: {parsed.unreadable.join(", ")}. Add it again below.
        </div>
      )}
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#9CA3AF" }}>Defined Prices</span>
          <button
            type="button"
            aria-label="Add price"
            onClick={() => {
              const id = nextId.current++;
              setRows((rs) => [...rs, { id, price: "", unit: "Each" }]);
            }}
            className="flex items-center justify-center hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            style={{ width: 28, height: 28, borderRadius: 6, color: "#0F172A" }}
          >
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="flex items-center justify-center py-7" style={{ borderRadius: 10, border: "1.5px dashed #E2E8F0", backgroundColor: "rgba(247,247,248,0.3)" }}>
            <span style={{ fontSize: 12, color: "#71717A" }}>No prices defined. Click + to add a price tier.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 300 }}>
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 min-w-0 bg-white border border-[#E2E8F0] rounded-lg px-3 focus-within:border-[#93C5FD]" style={{ height: 40 }}>
                    <span style={{ fontSize: 13, color: "#94A3B8", marginRight: 6 }}>$</span>
                    <input
                      autoFocus={!r.price}
                      inputMode="decimal"
                      value={r.price}
                      onChange={(e) => update(r.id, { price: e.target.value })}
                      onKeyDown={(e) => {
                        const dir = tabDir(e);
                        if (e.key === "Enter") {
                          e.preventDefault();
                          finalize("commit", serialise());
                        } else if (dir) {
                          e.preventDefault();
                          finalize("commit", serialise(), dir);
                        }
                      }}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent outline-none"
                      style={{ fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#0F172A" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUnitOpen(unitOpen === r.id ? null : r.id)}
                    className="flex items-center justify-between gap-1 px-3 bg-white border rounded-lg cursor-pointer"
                    style={{ width: 120, height: 40, fontSize: 13, color: "#0F172A", borderColor: unitOpen === r.id ? "#93C5FD" : "#E2E8F0" }}
                  >
                    <span className="truncate">{r.unit || "Unit"}</span>
                    <ChevronDown style={{ width: 13, height: 13, color: "#94A3B8" }} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove price"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    className="flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0 cursor-pointer"
                    style={{ width: 32, height: 40 }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {unitOpen === r.id && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                    {LIVE_PRICE_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          update(r.id, { unit: u });
                          setUnitOpen(null);
                        }}
                        className="px-2.5 rounded-md border cursor-pointer transition-colors"
                        style={{
                          height: 26,
                          fontSize: 12,
                          color: r.unit === u ? "#0A77FF" : "#334155",
                          backgroundColor: r.unit === u ? "#EDF4FF" : "#FFFFFF",
                          borderColor: r.unit === u ? "#93C5FD" : "#E2E8F0",
                          fontWeight: r.unit === u ? 600 : 400,
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter
        left={incomplete > 0 ? `${incomplete} tier${incomplete > 1 ? "s" : ""} without a price won't be saved` : `${rows.length} price${rows.length === 1 ? "" : "s"}`}
        onDone={() => finalize("commit", serialise())}
      />
    </EditorPopover>
  );
}
