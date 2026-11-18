/* Physical Inventory tabs: special cell editors, mirroring the controls of
 * your-invoice-mate's Adjust Inventory > Import (import-adjustment/cells/
 * CellEditors.tsx), which are the Increase grid's own controls.
 *
 * Column          Home control (Increase grid)                    Editor here
 * Part Number     (per-item import; no picker there)               ListCellPicker over the tab's items:
 *                                                                  part number, name, on-hand badge
 * Serial Number   the grid's text input                            TextCellEditor
 * LOT Number      LOT dropdown + "Create New LOT"                   ListCellPicker (Unit: X sub-lines,
 *                                                                  "New" badge, Create New LOT action)
 * Qty             QtyStepper (typed number, up / down steps)       QtyCellEditor
 * UoM             unit dropdown (the item's units)                 ListCellPicker (Units of measure)
 * Price           CompactInput with the "$" prefix                  PriceCellEditor
 * Location        CustomDropdown: DEFAULT / SUGGESTED / OTHERS,     ListCellPicker with the same groups,
 *                 zone / bay / warehouse line, on-hand badge        sub-lines and badges
 * Reason          ReasonDropdown + "Other (type a reason)"          ListCellPicker (Reasons, Other action)
 *
 * Contract: mount open / focused, finalize once, Enter commits and moves down,
 * Tab / Shift+Tab commits and moves right / left, Esc cancels. Every editor
 * commits the file's vocabulary (a part number, a location code, a reason
 * label, a unit). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { registerSpecialEditors, type CellNavDir, type SpecialCellEditor, type SpecialCellEditorProps } from "./registry";
import { ListCellPicker, type PickerOption } from "./physical-inventory/ListCellPicker";
import { PI_TABS, piExistingLots, piItemsFor, piTab, INCREASE_REASONS } from "../physical-inventory/piModule";
import { ALL_UOM_OPTIONS, EXTRA_LOCATION_CODES, LOCATION_DESCRIPTIONS, LOCATION_GROUPS, SERIALIZED_UOM, locationRows } from "../physical-inventory/piData";

type P = SpecialCellEditorProps;

function useFinalize(onCommit: P["onCommit"], onCancel: () => void) {
  const done = useRef(false);
  const commit = useCallback((next: string, dir: CellNavDir = "down") => {
    if (done.current) return;
    done.current = true;
    onCommit(next, dir);
  }, [onCommit]);
  const cancel = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCancel();
  }, [onCancel]);
  return { commit, cancel };
}

const CELL_WRAP: React.CSSProperties = { width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 4px" };
const INPUT_CLASS =
  "w-full h-8 bg-white border border-[#E2E8F0] rounded-md text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/15";

function inlineKeys(value: string, commit: (v: string, d?: CellNavDir) => void, cancel: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(value, "down"); }
    else if (e.key === "Tab") { e.preventDefault(); commit(value, e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
  };
}

/** Commits when focus leaves the editor for good (not between its own parts). */
function useCommitOnLeave(ref: React.RefObject<HTMLDivElement>, value: string, commit: (v: string) => void) {
  const v = useRef(value);
  v.current = value;
  return (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && ref.current?.contains(next)) return;
    commit(v.current);
  };
}

/* ── Text (Serial Number, a new LOT number, a typed reason) ── */
export function TextCellEditor({ initialValue, onCommit, onCancel, placeholder }: Pick<P, "initialValue" | "onCommit" | "onCancel"> & { placeholder?: string }) {
  const [value, setValue] = useState(initialValue);
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={inlineKeys(value, commit, cancel)}
      onBlur={() => commit(value)}
      className="w-full h-full bg-transparent outline-none px-3 text-[13px] text-[#1E293B] placeholder:text-[#94A3B8]"
    />
  );
}

/* ── Qty: the Increase grid's QtyStepper ── */
function QtyCellEditor({ initialValue, onCommit, onCancel }: P) {
  const [value, setValue] = useState(initialValue);
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const parse = (v: string) => {
    const n = parseInt(String(v).replace(/,/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const step = (d: number) => setValue(String(Math.max(0, parse(value) + d)));
  const onBlur = useCommitOnLeave(ref, value, commit);
  return (
    <div ref={ref} style={CELL_WRAP} onBlur={onBlur}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder="0"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
            else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
            else inlineKeys(value, commit, cancel)(e);
          }}
          className={`${INPUT_CLASS} pl-2 pr-6`}
        />
        <div className="absolute flex flex-col justify-between" style={{ right: 2, top: 1, bottom: 1, width: 18 }}>
          <button type="button" tabIndex={-1} aria-label="Increase" onClick={() => step(1)} className="flex items-center justify-center text-[#64748B] hover:text-[#0F172A] cursor-pointer" style={{ height: 15 }}>
            <ChevronUp size={12} />
          </button>
          <button type="button" tabIndex={-1} aria-label="Decrease" onClick={() => step(-1)} className="flex items-center justify-center text-[#64748B] hover:text-[#0F172A] cursor-pointer" style={{ height: 15 }}>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Price: the Increase grid's CompactInput with "$" ── */
function PriceCellEditor({ initialValue, onCommit, onCancel }: P) {
  const [value, setValue] = useState(initialValue.replace(/^\$/, ""));
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const onBlur = useCommitOnLeave(ref, value, commit);
  return (
    <div ref={ref} style={CELL_WRAP} onBlur={onBlur}>
      <div className="relative w-full">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8] pointer-events-none">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0.00"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={inlineKeys(value, commit, cancel)}
          className={`${INPUT_CLASS} pl-5 pr-2`}
        />
      </div>
    </div>
  );
}

/* ── List editors ── */

const LOCATION_GROUP_ORDER = ["Default", "Suggested", "Others"];

/** The Increase grid's LOCATION_OPTIONS: grouped, with the details line and on-hand badge. */
const LOCATION_OPTIONS: PickerOption[] = [
  ...locationRows
    .filter((r) => r.type === "location")
    .map((r) => ({
      value: r.locationCode,
      label: r.locationCode,
      sub: r.locationDetails,
      badge: `${r.onHandQty.toLocaleString()} EA`,
      group: LOCATION_GROUPS[r.locationCode] || "Others",
    }))
    .sort((a, b) => LOCATION_GROUP_ORDER.indexOf(a.group) - LOCATION_GROUP_ORDER.indexOf(b.group)),
  ...EXTRA_LOCATION_CODES.map((code) => ({ value: code, label: code, sub: LOCATION_DESCRIPTIONS[code], group: "Others" })),
];

function LocationCellEditor({ initialValue, onCommit, onCancel }: P) {
  return (
    <ListCellPicker
      value={initialValue}
      options={LOCATION_OPTIONS}
      searchPlaceholder="Search locations..."
      groupOrder={LOCATION_GROUP_ORDER}
      width={320}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}

function ReasonCellEditor({ initialValue, onCommit, onCancel }: P) {
  const [typing, setTyping] = useState(false);
  const options = useMemo<PickerOption[]>(() => INCREASE_REASONS.map((r) => ({ value: r.label, label: r.label, group: "Reasons" })), []);
  const current = INCREASE_REASONS.find((r) => r.label.toLowerCase() === initialValue.trim().toLowerCase() || r.value === initialValue.trim())?.label ?? initialValue;
  if (typing) return <TextCellEditor initialValue="" onCommit={onCommit} onCancel={onCancel} placeholder="Type custom reason..." />;
  return (
    <ListCellPicker
      value={current}
      options={options}
      searchPlaceholder="Search reasons..."
      action={{ label: "Other (type a reason)", icon: <Plus className="w-3.5 h-3.5" />, onSelect: () => setTyping(true) }}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}

function uomEditorFor(units: readonly string[]): SpecialCellEditor {
  return function UomCellEditor({ initialValue, onCommit, onCancel }: P) {
    const options = useMemo<PickerOption[]>(() => units.map((u) => ({ value: u, label: u, group: "Units of measure" })), []);
    return <ListCellPicker value={initialValue} options={options} searchPlaceholder="Search units..." onCommit={onCommit} onCancel={onCancel} />;
  };
}

function LotCellEditor({ initialValue, onCommit, onCancel }: P) {
  const [typing, setTyping] = useState(false);
  const raw = initialValue.trim();
  const options = useMemo<PickerOption[]>(() => {
    const known = piExistingLots().map((l) => ({ value: l.lot, label: l.lot, sub: `Unit: ${l.uom}` }));
    const isKnown = known.some((o) => o.value.toLowerCase() === raw.toLowerCase());
    return raw && !isKnown ? [...known, { value: raw, label: raw, sub: "Created on import", badge: "New" }] : known;
  }, [raw]);
  if (typing) return <TextCellEditor initialValue="" onCommit={onCommit} onCancel={onCancel} placeholder="New LOT number" />;
  return (
    <ListCellPicker
      value={initialValue}
      options={options}
      searchPlaceholder="Search LOTs..."
      defaultGroupLabel="LOTs"
      action={{ label: "Create New LOT", icon: <Plus className="w-3.5 h-3.5" />, onSelect: () => setTyping(true) }}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}

function PartNumberCellEditor({ initialValue, onCommit, onCancel, def }: P) {
  const mode = piTab(def.slug)?.mode ?? "serialized";
  const options = useMemo<PickerOption[]>(
    () => piItemsFor(mode).map((i) => ({ value: i.partNumber, label: i.partNumber, sub: i.name, badge: `${i.onHandQty.toLocaleString()} ${i.unit}`, group: "Items" })),
    [mode],
  );
  return <ListCellPicker value={initialValue} options={options} searchPlaceholder="Search items..." width={320} onCommit={onCommit} onCancel={onCancel} />;
}

function SerialCellEditor({ initialValue, onCommit, onCancel }: P) {
  return <TextCellEditor initialValue={initialValue} onCommit={onCommit} onCancel={onCancel} placeholder="e.g. SN-4001" />;
}

for (const tab of PI_TABS) {
  const serial = tab.mode === "serialized" || tab.mode === "lot-serialized";
  registerSpecialEditors(tab.slug, {
    partNumber: PartNumberCellEditor,
    serialNumber: SerialCellEditor,
    lotNumber: LotCellEditor,
    qty: QtyCellEditor,
    uom: uomEditorFor(serial ? [SERIALIZED_UOM] : ALL_UOM_OPTIONS),
    price: PriceCellEditor,
    location: LocationCellEditor,
    reason: ReasonCellEditor,
  });
}
