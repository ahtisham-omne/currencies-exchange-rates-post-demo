/* Choice editors for the Categories columns whose home create flow
 * (radiant-core-fusion CreateCategoryModal / ConfigureCategory) is a styled
 * picker rather than a plain list: Status pills, the Inventory Type pill row,
 * the Control Type radio cards, the Lot Tracking toggle tile, the Lot ID
 * Assignment radio options and the Acquisition Method cards. Each commits the
 * import's own vocabulary (the template's valid values). */

import { useState } from "react";
import { Check, ShoppingCart, Tags, Wrench } from "lucide-react";
import type { SpecialCellEditorProps } from "../registry";
import {
  CellEditorPopover,
  PanelFooter,
  PanelHeader,
  PanelNote,
  tabDir,
  useChoiceKeys,
  useFinalize,
} from "./shell";

const norm = (v: string) => String(v ?? "").trim().toLowerCase();
const matchIn = (v: string, options: readonly string[]) => options.find((o) => norm(o) === norm(v)) ?? null;
const splitPipe = (v: string) => String(v ?? "").split("|").map((s) => s.trim()).filter(Boolean);

/* ─── Status: the home Select shows each status as a pill ─── */
const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  Inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};
const STATUS_OPTIONS = ["Active", "Inactive"] as const;

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
      style={{ fontWeight: 500, backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {status}
    </span>
  );
}

export function StatusEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const current = matchIn(initialValue, STATUS_OPTIONS);
  const keys = useChoiceKeys(STATUS_OPTIONS, current ? STATUS_OPTIONS.indexOf(current as (typeof STATUS_OPTIONS)[number]) : 0, (s, dir) => commit(s, dir));
  return (
    <CellEditorPopover
      display={current ? <StatusPill status={current} /> : null}
      width={200}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={keys.onKeyDown}
      focusContent
    >
      <div className="p-1.5">
        {STATUS_OPTIONS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => commit(s)}
            onMouseEnter={() => keys.setActive(i)}
            className="flex items-center justify-between gap-3 w-full px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: keys.active === i ? "#F8FAFC" : "transparent" }}
          >
            <StatusPill status={s} />
            {current === s && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
          </button>
        ))}
      </div>
    </CellEditorPopover>
  );
}

/* ─── Inventory Type: three equal pills (ConfigureCategory 3-pill editor) ─── */
const INVENTORY_OPTIONS = ["Stock", "Non-stock", "Asset"] as const;

export function InventoryTypeEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const current = matchIn(initialValue, INVENTORY_OPTIONS);
  const keys = useChoiceKeys(INVENTORY_OPTIONS, current ? INVENTORY_OPTIONS.indexOf(current as (typeof INVENTORY_OPTIONS)[number]) : 0, (v, dir) => commit(v, dir));
  return (
    <CellEditorPopover display={current} width={340} onDismiss={cancel} onEscape={cancel} onKeyDown={keys.onKeyDown} focusContent>
      <PanelHeader label="Inventory Type" hint="Determine how this item is tracked in your inventory system." />
      <div className="grid grid-cols-3 gap-2 px-3.5 pb-3.5">
        {INVENTORY_OPTIONS.map((id, i) => {
          const isActive = current === id;
          const isFocus = keys.active === i;
          return (
            <button
              key={id}
              type="button"
              onClick={() => commit(id)}
              onMouseEnter={() => keys.setActive(i)}
              className="transition-all duration-150 cursor-pointer flex items-center justify-center"
              style={{
                height: 44,
                borderRadius: 8,
                border: `1px solid ${isActive ? "#93C5FD" : isFocus ? "#CBD5E1" : "#E2E8F0"}`,
                backgroundColor: isActive ? "#EFF6FF" : "white",
                color: isActive ? "#0A77FF" : "#334155",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {id}
            </button>
          );
        })}
      </div>
    </CellEditorPopover>
  );
}

/* ─── Control Type: two radio cards with a one-line description ─── */
const CONTROL_OPTIONS = [
  { id: "Serialized", desc: "Unique ID per unit." },
  { id: "Non-Serialized", desc: "Tracked in bulk by quantity." },
] as const;

function RadioDot({ selected, size = 16 }: { selected: boolean; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, border: selected ? "2px solid #3B82F6" : "1.5px solid #D1D5DB", backgroundColor: "white" }}
    >
      {selected && <div style={{ width: size / 2, height: size / 2, borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
    </div>
  );
}

export function ControlTypeEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const ids = CONTROL_OPTIONS.map((o) => o.id);
  const current = matchIn(initialValue, ids);
  const keys = useChoiceKeys(ids, current ? ids.indexOf(current as (typeof ids)[number]) : 0, (v, dir) => commit(v, dir));
  return (
    <CellEditorPopover display={current} width={380} onDismiss={cancel} onEscape={cancel} onKeyDown={keys.onKeyDown} focusContent>
      <PanelHeader label="Control Type" hint="Define how individual units are identified and traced." />
      <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
        {CONTROL_OPTIONS.map((ct, i) => {
          const isActive = current === ct.id;
          const isFocus = keys.active === i;
          return (
            <button
              key={ct.id}
              type="button"
              onClick={() => commit(ct.id)}
              onMouseEnter={() => keys.setActive(i)}
              className="relative transition-all duration-150 cursor-pointer flex flex-col items-start justify-center gap-1 text-left"
              style={{
                height: 76,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${isActive ? "#93C5FD" : isFocus ? "#CBD5E1" : "#E2E8F0"}`,
                backgroundColor: isActive ? "#EFF6FF" : "white",
              }}
            >
              <div className="absolute top-2.5 right-2.5">
                <RadioDot selected={isActive} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: 0, paddingRight: 20 }}>{ct.id}</p>
              <p className="line-clamp-1" style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>{ct.desc}</p>
            </button>
          );
        })}
      </div>
    </CellEditorPopover>
  );
}

/* ─── Lot Tracking: the single-row toggle tile ─── */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 transition-colors cursor-pointer"
      style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: checked ? "#0A77FF" : "#E2E8F0" }}
    >
      <div
        className="absolute bg-white rounded-full shadow-sm"
        style={{ width: 18, height: 18, top: 2, left: checked ? 20 : 2, transition: "left 0.15s ease" }}
      />
    </button>
  );
}

export function LotTrackingEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const initial = ["yes", "y", "true", "1"].includes(norm(initialValue));
  const [on, setOn] = useState(initial);
  const known = ["yes", "y", "true", "1", "no", "n", "false", "0"].includes(norm(initialValue));
  const flip = (next: boolean) => {
    setOn(next);
    /* Let the knob finish its slide before the cell closes. */
    window.setTimeout(() => commit(next ? "Yes" : "No"), 160);
  };
  return (
    <CellEditorPopover
      display={known ? (initial ? "Yes" : "No") : null}
      width={320}
      onDismiss={() => commit(on ? "Yes" : "No")}
      onEscape={cancel}
      focusContent
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setOn((v) => !v);
        } else if (e.key === "Enter") {
          e.preventDefault();
          commit(on ? "Yes" : "No");
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit(on ? "Yes" : "No", tabDir(e));
        }
      }}
    >
      <div className="p-2.5">
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0", backgroundColor: "white" }}>
          <div className="flex items-center justify-between gap-3 cursor-pointer" style={{ minHeight: 56, padding: "8px 12px" }} onClick={() => flip(!on)}>
            <div className="flex items-center gap-2 min-w-0">
              <Tags style={{ width: 16, height: 16, color: on ? "#0A77FF" : "#64748B", flexShrink: 0 }} />
              <div className="min-w-0">
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: 0 }}>Lot Tracking</p>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, marginTop: 1, lineHeight: 1.3 }}>Enable batch-level traceability.</p>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <ToggleSwitch checked={on} onChange={flip} />
            </div>
          </div>
        </div>
      </div>
    </CellEditorPopover>
  );
}

/* ─── Lot ID Assignment: the two radio options under Lot Tracking ─── */
const LOT_ID_OPTIONS = [
  { value: "System Generated", label: "System Generated", desc: "Auto-generate IDs based on prefix." },
  { value: "Vendor Lot", label: "Use vendor lot as lot ID", desc: "Vendor lot number becomes Lot ID." },
] as const;

export function LotIdSourceEditor({ initialValue, onCommit, onCancel, row }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const values = LOT_ID_OPTIONS.map((o) => o.value);
  const current = matchIn(initialValue, values);
  const keys = useChoiceKeys(values, current ? values.indexOf(current as (typeof values)[number]) : 0, (v, dir) => commit(v, dir));
  const lotOn = ["yes", "y", "true", "1"].includes(norm(row.lotControlEnabled ?? ""));
  return (
    <CellEditorPopover display={current} width={340} onDismiss={cancel} onEscape={cancel} onKeyDown={keys.onKeyDown} focusContent>
      <PanelHeader label="Lot ID Assignment" />
      {!lotOn && <PanelNote>Lot ID Assignment only applies when Lot Tracking is Yes for this row.</PanelNote>}
      <div className="flex flex-col gap-2 px-3.5 pb-3.5">
        {LOT_ID_OPTIONS.map((o, i) => {
          const selected = current === o.value;
          const isFocus = keys.active === i;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => commit(o.value)}
              onMouseEnter={() => keys.setActive(i)}
              className={`group relative rounded-xl overflow-hidden border transition-all duration-200 w-full text-left cursor-pointer ${
                selected
                  ? "border-[#93C5FD]/70 bg-[#EFF6FF] shadow-[0_1px_4px_rgba(10,119,255,0.06)]"
                  : isFocus
                    ? "border-[#BFDBFE] bg-[#F8FAFF]"
                    : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFF]"
              }`}
            >
              <div className="relative flex items-center gap-3 p-3.5">
                <RadioDot selected={selected} size={18} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-[#0F172A]">{o.label}</span>
                  <span className="text-[12px] text-[#94A3B8]">{o.desc}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </CellEditorPopover>
  );
}

/* ─── Acquisition Method: the Purchased / Manufactured cards ─── */
const METHODS = [
  {
    id: "Purchased",
    Icon: ShoppingCart,
    desc: "Sourced from a vendor, triggers a Purchase Order recommendation.",
    accent: "#0A77FF",
    bgSelected: "#EFF6FF",
    borderSelected: "#93C5FD",
    iconBgSelected: "#D6E8FF",
  },
  {
    id: "Manufactured",
    Icon: Wrench,
    desc: "Produced in-house, triggers a Work Order recommendation.",
    accent: "#D97706",
    bgSelected: "#FFFBEB",
    borderSelected: "#FCD34D",
    iconBgSelected: "#FEF3C7",
  },
] as const;
const METHOD_IDS = METHODS.map((m) => m.id);

function MethodCard({
  method,
  isActive,
  isFocus,
  corner,
  onClick,
  onHover,
}: {
  method: (typeof METHODS)[number];
  isActive: boolean;
  isFocus: boolean;
  corner: React.ReactNode;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={onHover}
      className={`group relative cursor-pointer p-3 rounded-lg border transition-all duration-150 flex flex-col items-start gap-1.5 ${
        isActive ? "" : "bg-white hover:bg-[#FAFCFF] hover:border-[#CBD5E1]"
      }`}
      style={{
        minHeight: 96,
        backgroundColor: isActive ? method.bgSelected : "white",
        borderColor: isActive ? method.borderSelected : isFocus ? "#CBD5E1" : "#E2E8F0",
        boxShadow: isActive
          ? `0 0 0 1px ${method.borderSelected}55, 0 1px 3px rgba(0,0,0,0.04)`
          : "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="absolute top-2.5 right-2.5 flex items-center justify-center" style={{ minWidth: 20, height: 20 }}>
        {corner}
      </div>
      <div
        className="flex items-center justify-center shrink-0 rounded-md"
        style={{ width: 28, height: 28, backgroundColor: isActive ? method.iconBgSelected : "#F1F5F9" }}
      >
        <method.Icon style={{ width: 14, height: 14, color: isActive ? method.accent : "#64748B" }} />
      </div>
      <span className="block" style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? method.accent : "#0F172A", lineHeight: 1.2 }}>
        {method.id}
      </span>
      <span className="block line-clamp-2" style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.35, paddingRight: 28 }}>
        {method.desc}
      </span>
    </div>
  );
}

function CheckCorner({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center rounded-full" style={{ width: 20, height: 20, backgroundColor: accent }}>
      <Check style={{ width: 12, height: 12, color: "white" }} strokeWidth={3} />
    </div>
  );
}

function EmptyCorner() {
  return <div className="rounded-full border-2 border-slate-300 bg-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 20, height: 20 }} />;
}

export function AcquisitionMethodsEditor({ initialValue, onCommit, onCancel }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const [picked, setPicked] = useState<string[]>(() =>
    METHOD_IDS.filter((id) => splitPipe(initialValue).some((v) => norm(v) === norm(id))),
  );
  const [active, setActive] = useState(0);
  const value = () => METHOD_IDS.filter((id) => picked.includes(id)).join("|");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const initialDisplay = METHOD_IDS.filter((id) => splitPipe(initialValue).some((v) => norm(v) === norm(id)));
  return (
    <CellEditorPopover
      display={initialValue.trim() ? (initialDisplay.length ? initialDisplay.join(" | ") : initialValue) : null}
      width={440}
      onDismiss={() => commit(value())}
      onEscape={cancel}
      focusContent
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setActive((i) => (i + 1) % 2);
        } else if (e.key === " ") {
          e.preventDefault();
          toggle(METHOD_IDS[active]);
        } else if (e.key === "Enter") {
          e.preventDefault();
          commit(value());
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit(value(), tabDir(e));
        }
      }}
    >
      <PanelHeader label="Acquisition Method" hint="How is this item brought into stock? (Select all that apply)" />
      <div className="grid grid-cols-2 gap-2 px-3.5 pb-3">
        {METHODS.map((m, i) => {
          const isActive = picked.includes(m.id);
          return (
            <MethodCard
              key={m.id}
              method={m}
              isActive={isActive}
              isFocus={active === i}
              corner={isActive ? <CheckCorner accent={m.accent} /> : <EmptyCorner />}
              onClick={() => toggle(m.id)}
              onHover={() => setActive(i)}
            />
          );
        })}
      </div>
      <PanelFooter left={`${picked.length} selected`} onDone={() => commit(value())} />
    </CellEditorPopover>
  );
}

/* ─── Primary Acquisition: the same cards, one marked Primary ─── */
export function PrimaryAcquisitionEditor({ initialValue, onCommit, onCancel, row }: SpecialCellEditorProps) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const current = matchIn(initialValue, METHOD_IDS);
  const keys = useChoiceKeys(METHOD_IDS, current ? METHOD_IDS.indexOf(current as (typeof METHOD_IDS)[number]) : 0, (v, dir) => commit(v, dir));
  const methods = splitPipe(row.acquisitionMethods ?? "").map(norm);
  const both = methods.includes("purchased") && methods.includes("manufactured");
  return (
    <CellEditorPopover display={current} width={440} onDismiss={cancel} onEscape={cancel} onKeyDown={keys.onKeyDown} focusContent>
      <PanelHeader label="Primary Acquisition" hint="The method Omne recommends first when both are allowed." />
      {!both && <PanelNote>Primary Acquisition only applies when this row's Acquisition Method includes both Purchased and Manufactured.</PanelNote>}
      <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
        {METHODS.map((m, i) => {
          const isPrimary = current === m.id;
          return (
            <MethodCard
              key={m.id}
              method={m}
              isActive={isPrimary}
              isFocus={keys.active === i}
              corner={
                isPrimary ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md" style={{ fontSize: 10, fontWeight: 600, background: m.accent, color: "#FFFFFF" }}>
                    Primary
                  </span>
                ) : (
                  <EmptyCorner />
                )
              }
              onClick={() => commit(m.id)}
              onHover={() => keys.setActive(i)}
            />
          );
        })}
      </div>
    </CellEditorPopover>
  );
}
