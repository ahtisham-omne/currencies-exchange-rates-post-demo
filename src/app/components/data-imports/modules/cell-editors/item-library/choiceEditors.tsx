/* Single-choice and toggle editors for the Item Library import: every field
 * the Create New Item flow edits with cards, tiles, radio rows, segmented
 * pills or a switch instead of a plain list. Each commits the file value the
 * import validator reads (spec.data.mjs vocabulary). */

import { useMemo, useState, type ReactNode } from "react";
import { Check, Star, Tags } from "lucide-react";
import type { SpecialCellEditorProps } from "../registry";
import { matchOption, parseYesNo, splitPipe } from "../../item-library/helpers";
import {
  ACQUISITION_METHODS,
  CONTROL_TYPES,
  INVENTORY_TYPES,
  LOT_ID_SOURCES,
  SCAN_ROWS,
  SELLING_SCOPES,
  SHELF_LIFE_UNITS,
  SHORTAGE_RULES,
  STATUS_META,
  VALUATION_METHODS,
} from "./data";
import {
  CellTrigger,
  EditorPopover,
  PanelHeader,
  RadioDot,
  ToggleSwitch,
  tabDir,
  useFinalize,
  useListNav,
} from "./shell";

/* ─── Generic single-choice frame ─────────────────────────────── */

interface ChoiceOption {
  value: string;
}

/** Keyboard + finalize wiring shared by every single-choice editor: arrows
 *  move the highlight, Enter or Tab commits it, Escape cancels, a click
 *  commits the clicked option, dismissing keeps the old value. */
function useChoice<T extends ChoiceOption>(p: SpecialCellEditorProps, options: readonly T[]) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const current = matchOption(p.initialValue, options.map((o) => o.value));
  const startIdx = Math.max(0, options.findIndex((o) => o.value === current));
  const nav = useListNav(options.length, startIdx);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (nav.onArrow(e)) return;
    const dir = tabDir(e);
    if (dir) {
      e.preventDefault();
      finalize("commit", options[nav.active]?.value ?? p.initialValue, dir);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      finalize("commit", options[nav.active]?.value ?? p.initialValue);
    }
  };
  return { finalize, current, nav, onKeyDown, pick: (v: string) => finalize("commit", v) };
}

function ChoicePopover({
  p,
  width,
  display,
  onKeyDown,
  finalize,
  children,
}: {
  p: SpecialCellEditorProps;
  width: number;
  display: ReactNode;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  finalize: ReturnType<typeof useFinalize>;
  children: ReactNode;
}) {
  return (
    <EditorPopover
      trigger={<CellTrigger>{display}</CellTrigger>}
      width={width}
      onDismiss={() => finalize("cancel")}
      onEscape={() => finalize("cancel")}
      onKeyDown={onKeyDown}
    >
      {children}
    </EditorPopover>
  );
}

/* ─── Status: tinted status chips with their description ────────── */

export function StatusEditor(p: SpecialCellEditorProps) {
  const options = useMemo(() => Object.keys(STATUS_META).map((value) => ({ value })), []);
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, options);
  const chip = (v: string) => {
    const m = STATUS_META[v];
    return (
      <span
        className="inline-flex items-center rounded-full border px-2 py-px"
        style={{ fontSize: "12px", fontWeight: 500, backgroundColor: m.bg, color: m.text, borderColor: m.border }}
      >
        {v}
      </span>
    );
  };
  return (
    <ChoicePopover p={p} width={300} display={current ? chip(current) : p.initialValue || null} onKeyDown={onKeyDown} finalize={finalize}>
      <div className="p-1.5">
        {options.map((o, i) => {
          const selected = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-start gap-2.5 w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer outline-none"
              style={{ backgroundColor: nav.active === i ? "#F1F5F9" : "transparent" }}
            >
              <span className="w-4 shrink-0 pt-0.5">{selected && <Check className="w-4 h-4" style={{ color: "#0A77FF" }} />}</span>
              <span className="flex-1 min-w-0">
                {chip(o.value)}
                <span className="block mt-1" style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
                  {STATUS_META[o.value].description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </ChoicePopover>
  );
}

/* ─── Segmented pills: Inventory Type, Shelf Life Unit ─────────── */

function SegmentedEditor({
  p,
  title,
  hint,
  values,
  columns,
}: {
  p: SpecialCellEditorProps;
  title: string;
  hint: string;
  values: readonly string[];
  columns: number;
}) {
  const options = useMemo(() => values.map((value) => ({ value })), [values]);
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, options);
  return (
    <ChoicePopover p={p} width={columns * 104 + 28} display={current ?? (p.initialValue || null)} onKeyDown={onKeyDown} finalize={finalize}>
      <PanelHeader title={title} hint={hint} />
      <div className="p-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((o, i) => {
          const selected = current === o.value;
          const hl = nav.active === i;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-center justify-center transition-all cursor-pointer outline-none"
              style={{
                height: 44,
                borderRadius: 8,
                border: `1px solid ${selected ? "#93C5FD" : hl ? "#CBD5E1" : "#E2E8F0"}`,
                backgroundColor: selected ? "#EFF6FF" : hl ? "#FAFCFF" : "#FFFFFF",
                color: selected ? "#0A77FF" : "#334155",
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
              }}
            >
              {o.value}
            </button>
          );
        })}
      </div>
    </ChoicePopover>
  );
}

export function InventoryTypeEditor(p: SpecialCellEditorProps) {
  return (
    <SegmentedEditor p={p} title="Inventory Type" hint="Determine how this item is tracked in your inventory system." values={INVENTORY_TYPES} columns={3} />
  );
}

export function ShelfLifeUnitEditor(p: SpecialCellEditorProps) {
  return <SegmentedEditor p={p} title="Shelf Life Unit" hint="The unit the Shelf Life number is counted in." values={SHELF_LIFE_UNITS} columns={3} />;
}

/* ─── Control Type: 76px tiles with a corner radio ────────────── */

export function ControlTypeEditor(p: SpecialCellEditorProps) {
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, CONTROL_TYPES);
  return (
    <ChoicePopover p={p} width={300} display={current ?? (p.initialValue || null)} onKeyDown={onKeyDown} finalize={finalize}>
      <PanelHeader title="Control Type" hint="Define how individual units are identified and traced." />
      <div className="p-3 flex flex-col gap-2">
        {CONTROL_TYPES.map((o, i) => {
          const selected = current === o.value;
          const hl = nav.active === i;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              onMouseEnter={() => nav.setActive(i)}
              className="relative flex flex-col items-start justify-center gap-1 text-left transition-all cursor-pointer outline-none"
              style={{
                height: 76,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${selected ? "#93C5FD" : hl ? "#CBD5E1" : "#E2E8F0"}`,
                backgroundColor: selected ? "#EFF6FF" : hl ? "#FAFCFF" : "#FFFFFF",
              }}
            >
              <span
                className="absolute rounded-full flex items-center justify-center bg-white"
                style={{ top: 10, right: 10, width: 16, height: 16, border: selected ? "2px solid #3B82F6" : "1.5px solid #D1D5DB" }}
              >
                {selected && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", paddingRight: 20 }}>{o.label}</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{o.desc}</span>
            </button>
          );
        })}
      </div>
    </ChoicePopover>
  );
}

/* ─── RadioOption rows: Lot ID Assignment, Selling Scope, PO rules ── */

function RadioRowsEditor({
  p,
  title,
  hint,
  options,
  width,
}: {
  p: SpecialCellEditorProps;
  title: string;
  hint?: string;
  options: { value: string; label: string; desc: string }[];
  width: number;
}) {
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, options);
  const display = options.find((o) => o.value === current)?.value ?? (p.initialValue || null);
  return (
    <ChoicePopover p={p} width={width} display={display} onKeyDown={onKeyDown} finalize={finalize}>
      <PanelHeader title={title} hint={hint} />
      <div className="p-3 flex flex-col gap-2 overflow-y-auto">
        {options.map((o, i) => {
          const selected = current === o.value;
          const hl = nav.active === i;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-start gap-3 w-full text-left rounded-xl border transition-all cursor-pointer outline-none"
              style={{
                padding: 14,
                borderColor: selected ? "rgba(147,197,253,0.7)" : hl ? "#BFDBFE" : "#E2E8F0",
                backgroundColor: selected ? "#EFF6FF" : hl ? "#F8FAFF" : "#FFFFFF",
                boxShadow: selected ? "0 1px 4px rgba(10,119,255,0.06)" : undefined,
              }}
            >
              <span className="pt-px">
                <RadioDot selected={selected} />
              </span>
              <span className="flex flex-col min-w-0">
                <span style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>{o.label}</span>
                <span style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.45 }}>{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </ChoicePopover>
  );
}

export function LotIdSourceEditor(p: SpecialCellEditorProps) {
  return <RadioRowsEditor p={p} title="Lot ID Assignment" hint="How lot IDs are assigned when this item is received." options={LOT_ID_SOURCES} width={320} />;
}

export function SellingScopeEditor(p: SpecialCellEditorProps) {
  return <RadioRowsEditor p={p} title="Selling Scope" hint="Control which partners can sell this item." options={SELLING_SCOPES} width={360} />;
}

export function ShortageRuleEditor(p: SpecialCellEditorProps) {
  const options = SHORTAGE_RULES.map((r) => ({ value: r.value, label: r.title, desc: r.desc }));
  return (
    <RadioRowsEditor
      p={p}
      title="PO Recommendation Rules"
      hint="Select the rule that determines when a Purchase Order is recommended to restock this item."
      options={options}
      width={380}
    />
  );
}

/* ─── Inventory Valuation: 2 x 2 method cards ─────────────────── */

function ValuationVisual({ method }: { method: string }) {
  const box = (label: string, style: React.CSSProperties, key?: string) => (
    <span key={key ?? label} className="inline-flex items-center justify-center rounded-md" style={{ width: 26, height: 22, fontSize: 10, fontWeight: 700, ...style }}>
      {label}
    </span>
  );
  const ghost: React.CSSProperties = { color: "#0F172A", opacity: 0.4, border: "1px solid #E2E8F0", fontWeight: 600 };
  const arrow = <span style={{ fontSize: 12, color: "#0F172A", opacity: 0.25 }}>→</span>;
  if (method === "FIFO")
    return (
      <div className="flex items-center gap-1">
        {box("1", { color: "#FFFFFF", backgroundColor: "#22C55E" })}
        {arrow}
        {[2, 3, 4].map((n) => box(String(n), ghost))}
      </div>
    );
  if (method === "LIFO")
    return (
      <div className="flex items-center gap-1">
        {[1, 2].map((n) => box(String(n), ghost))}
        {box("3", { color: "#FFFFFF", backgroundColor: "#0A77FF" })}
        {arrow}
      </div>
    );
  if (method === "WAC")
    return (
      <div className="flex items-center gap-1">
        {["$10", "$12", "$11"].map((v) => box(v, { width: 30, color: "#15803D", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", fontSize: 9 }))}
        {arrow}
        <span className="inline-flex items-center justify-center rounded-full" style={{ height: 22, padding: "0 8px", fontSize: 10, fontWeight: 700, color: "#FFFFFF", backgroundColor: "#16A34A" }}>
          $11
        </span>
      </div>
    );
  const colors = ["#EF4444", "#F97316", "#8B5CF6"];
  const bgs = ["#FEF2F2", "#FFF7ED", "#F5F3FF"];
  const borders = ["#FECACA", "#FED7AA", "#DDD6FE"];
  return (
    <div className="flex items-center gap-1">
      {["A1", "B2", "C3"].map((t, i) => box(t, { color: colors[i], backgroundColor: bgs[i], border: `1px solid ${borders[i]}` }))}
    </div>
  );
}

export function ValuationEditor(p: SpecialCellEditorProps) {
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, VALUATION_METHODS);
  return (
    <ChoicePopover p={p} width={440} display={current ?? (p.initialValue || null)} onKeyDown={onKeyDown} finalize={finalize}>
      <PanelHeader title="Inventory Valuation" hint="Cost accounting method for this item. Determines how unit costs flow through inventory and COGS." />
      <div className="p-3 grid grid-cols-2 gap-2.5">
        {VALUATION_METHODS.map((o, i) => {
          const selected = current === o.value;
          const hl = nav.active === i;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              onMouseEnter={() => nav.setActive(i)}
              className="relative flex flex-col text-left transition-all cursor-pointer outline-none"
              style={{
                padding: 14,
                borderRadius: 12,
                border: selected ? "2px solid #0A77FF" : `1px solid ${hl ? "#CBD5E1" : "#E2E8F0"}`,
                backgroundColor: selected ? "#EDF4FF" : "#FFFFFF",
                boxShadow: selected ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              {selected && <Check className="absolute" style={{ top: 12, right: 12, width: 16, height: 16, color: "#0A77FF" }} />}
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{o.title}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#0A77FF", marginTop: 1 }}>{o.subtitle}</span>
              <span style={{ fontSize: 12, color: "#0F172A", opacity: 0.5, marginTop: 3 }}>{o.desc}</span>
              <div style={{ marginTop: 12 }}>
                <ValuationVisual method={o.value} />
              </div>
            </button>
          );
        })}
      </div>
    </ChoicePopover>
  );
}

/* ─── Acquisition Method (multi) + Primary Acquisition (single) ─── */

function AcquisitionCard({
  meta,
  active,
  highlighted,
  badge,
  onClick,
  onHover,
}: {
  meta: (typeof ACQUISITION_METHODS)[number];
  active: boolean;
  highlighted: boolean;
  badge: ReactNode;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className="relative flex flex-col items-start gap-1.5 text-left p-3 rounded-lg border transition-all cursor-pointer outline-none"
      style={{
        minHeight: 104,
        backgroundColor: active ? meta.bgSelected : highlighted ? "#FAFCFF" : "#FFFFFF",
        borderColor: active ? meta.borderSelected : highlighted ? "#CBD5E1" : "#E2E8F0",
        boxShadow: active ? `0 0 0 1px ${meta.borderSelected}55, 0 1px 3px rgba(0,0,0,0.04)` : "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <span className="absolute flex items-center justify-center" style={{ top: 10, right: 10, minWidth: 20, height: 20 }}>
        {badge}
      </span>
      <span className="flex items-center justify-center rounded-md" style={{ width: 28, height: 28, backgroundColor: active ? meta.iconBgSelected : "#F1F5F9" }}>
        <Icon style={{ width: 14, height: 14, color: active ? meta.accent : "#64748B" }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: active ? meta.accent : "#0F172A" }}>{meta.label}</span>
      <span style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>{meta.desc}</span>
    </button>
  );
}

function checkBadge(accent: string) {
  return (
    <span className="flex items-center justify-center rounded-full" style={{ width: 20, height: 20, backgroundColor: accent }}>
      <Check className="text-white" style={{ width: 12, height: 12 }} strokeWidth={3} />
    </span>
  );
}

export function AcquisitionMethodsEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const values = ACQUISITION_METHODS.map((m) => m.value);
  const [selected, setSelected] = useState<string[]>(() =>
    splitPipe(p.initialValue)
      .map((v) => matchOption(v, values))
      .filter((v): v is string => !!v),
  );
  const nav = useListNav(values.length, 0);
  const joined = () => values.filter((v) => selected.includes(v)).join("|");
  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const primary = matchOption(p.row.primaryAcquisition ?? "", values);
  return (
    <EditorPopover
      trigger={<CellTrigger>{selected.length ? joined().split("|").join(" · ") : p.initialValue || null}</CellTrigger>}
      width={420}
      onDismiss={() => finalize("commit", joined())}
      onEscape={() => finalize("cancel")}
      onKeyDown={(e) => {
        if (nav.onArrow(e)) return;
        const dir = tabDir(e);
        if (dir) {
          e.preventDefault();
          finalize("commit", joined(), dir);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(values[nav.active]);
        }
      }}
    >
      <PanelHeader title="Acquisition Method" hint="How is this item brought into stock? (Select all that apply)" />
      <div className="p-3 grid grid-cols-2 gap-2">
        {ACQUISITION_METHODS.map((m, i) => {
          const active = selected.includes(m.value);
          const both = selected.length === 2;
          const badge = active ? (
            both && primary === m.value ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md" style={{ fontSize: 10, fontWeight: 600, background: m.accent, color: "#FFFFFF" }}>
                Primary
              </span>
            ) : (
              checkBadge(m.accent)
            )
          ) : (
            <span className="rounded-full border-2 border-[#CBD5E1] bg-white" style={{ width: 20, height: 20 }} />
          );
          return (
            <AcquisitionCard
              key={m.value}
              meta={m}
              active={active}
              highlighted={nav.active === i}
              badge={badge}
              onClick={() => toggle(m.value)}
              onHover={() => nav.setActive(i)}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9] shrink-0">
        <span style={{ fontSize: "12px", color: "#64748B" }}>{selected.length} selected</span>
        <button
          type="button"
          onClick={() => finalize("commit", joined())}
          className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer outline-none"
          style={{ fontSize: "12.5px", fontWeight: 600 }}
        >
          Done
        </button>
      </div>
    </EditorPopover>
  );
}

export function PrimaryAcquisitionEditor(p: SpecialCellEditorProps) {
  const { finalize, current, nav, onKeyDown, pick } = useChoice(p, ACQUISITION_METHODS);
  const declared = splitPipe(p.row.acquisitionMethods ?? "")
    .map((v) => matchOption(v, ACQUISITION_METHODS.map((m) => m.value)))
    .filter(Boolean);
  return (
    <ChoicePopover p={p} width={420} display={current ?? (p.initialValue || null)} onKeyDown={onKeyDown} finalize={finalize}>
      <PanelHeader
        title="Primary Acquisition"
        hint={
          declared.length === 2
            ? "Both methods are selected. Star the one the system recommends first."
            : "The method the system recommends first when the item can be bought and made."
        }
      />
      <div className="p-3 grid grid-cols-2 gap-2">
        {ACQUISITION_METHODS.map((m, i) => {
          const isPrimary = current === m.value;
          const badge = isPrimary ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md" style={{ fontSize: 10, fontWeight: 600, background: m.accent, color: "#FFFFFF" }}>
              Primary
            </span>
          ) : (
            <Star className="text-[#94A3B8]" style={{ width: 16, height: 16 }} />
          );
          return (
            <AcquisitionCard
              key={m.value}
              meta={m}
              active={isPrimary || declared.includes(m.value)}
              highlighted={nav.active === i}
              badge={badge}
              onClick={() => pick(m.value)}
              onHover={() => nav.setActive(i)}
            />
          );
        })}
      </div>
    </ChoicePopover>
  );
}

/* ─── Yes / No switches: Lot Tracking, Scan Enforcement ────────── */

function ToggleRowEditor({ p, label, desc, icon }: { p: SpecialCellEditorProps; label: string; desc: string; icon?: ReactNode }) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const initial = parseYesNo(p.initialValue);
  const [on, setOn] = useState<boolean>(initial ?? false);
  const value = (v: boolean) => (v ? "Yes" : "No");
  return (
    <EditorPopover
      trigger={<CellTrigger>{initial === null ? p.initialValue || null : value(initial)}</CellTrigger>}
      width={320}
      onDismiss={() => finalize("cancel")}
      onEscape={() => finalize("cancel")}
      onKeyDown={(e) => {
        const dir = tabDir(e);
        if (dir) {
          e.preventDefault();
          finalize("commit", value(on), dir);
        } else if (e.key === " ") {
          e.preventDefault();
          setOn((v) => !v);
        } else if (e.key === "Enter") {
          e.preventDefault();
          finalize("commit", value(on));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setOn(e.key === "ArrowRight");
        }
      }}
    >
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            const next = !on;
            setOn(next);
            finalize("commit", value(next));
          }}
          className="flex items-center justify-between gap-3 w-full text-left border rounded-lg cursor-pointer outline-none"
          style={{ minHeight: 56, padding: "8px 12px", borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="min-w-0">
              <span className="block" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{label}</span>
              <span className="block" style={{ fontSize: 12, color: "#94A3B8", marginTop: 1, lineHeight: 1.3 }}>{desc}</span>
            </span>
          </span>
          <ToggleSwitch checked={on} />
        </button>
        <div className="flex items-center justify-between mt-2 px-0.5" style={{ fontSize: 11.5, color: "#94A3B8" }}>
          <span>Imports as {value(on)}</span>
          <span>Space to switch, Enter to save</span>
        </div>
      </div>
    </EditorPopover>
  );
}

export function LotTrackingEditor(p: SpecialCellEditorProps) {
  const on = parseYesNo(p.initialValue);
  return (
    <ToggleRowEditor
      p={p}
      label="Lot Tracking"
      desc="Enable batch-level traceability."
      icon={<Tags style={{ width: 16, height: 16, color: on ? "#0A77FF" : "#64748B", flexShrink: 0 }} />}
    />
  );
}

export function scanEditor(key: keyof typeof SCAN_ROWS) {
  return function ScanEditor(p: SpecialCellEditorProps) {
    const row = SCAN_ROWS[key];
    const desc =
      key === "scanSerial" && (p.row.inventoryControlType ?? "").trim().toLowerCase() !== "serialized"
        ? "Available only when Control Type is Serialized"
        : row.desc;
    return <ToggleRowEditor p={p} label={row.label} desc={desc} />;
  };
}
