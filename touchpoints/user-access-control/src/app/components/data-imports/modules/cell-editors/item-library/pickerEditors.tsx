/* Searchable pickers for the Item Library import: the unit of measure list,
 * the location multi-select, the Select Customers partner picker, the owner
 * and approver people pickers, and the Category Selection card grid. Each
 * mirrors its Create New Item counterpart and commits the file vocabulary
 * (pipe-joined for lists). */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, Star, X } from "lucide-react";
import type { SpecialCellEditorProps } from "../registry";
import { splitPipe } from "../../item-library/helpers";
import { CATEGORIES, MOCK_APPROVERS, MOCK_USERS } from "../../item-library/live";
import {
  LIVE_APPROVER_NAMES,
  LIVE_CATEGORY_CODES,
  LIVE_LOCATIONS,
  LIVE_PARTNER_NAMES,
  LIVE_USER_NAMES,
  unitOptionGroups,
} from "../../item-library/spec";
import { APPROVER_META, CATEGORY_ICONS, ITEM_USERS, OWNER_SLOT_PERMISSIONS, PARTNER_PROFILE } from "./data";
import {
  CELL_FONT,
  CheckBox,
  CellTrigger,
  EditorPopover,
  EmptyResults,
  Initials,
  PanelFooter,
  PanelHeader,
  SearchField,
  SectionLabel,
  UnitBadge,
  UomTypePill,
  tabDir,
  useFinalize,
  useListNav,
} from "./shell";

/* ─── helpers ─── */

function canonicalIn(value: string, options: readonly string[]): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return options.find((o) => o.toLowerCase() === v) ?? null;
}

/** Pipe list -> known names in canonical spelling (unknown names dropped:
 *  they are what the validator flags, and re-picking is the fix). */
function parseKnown(value: string, options: readonly string[]): string[] {
  const out: string[] = [];
  for (const part of splitPipe(value)) {
    const c = canonicalIn(part, options);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

function unknownParts(value: string, options: readonly string[]): string[] {
  return splitPipe(value).filter((part) => !canonicalIn(part, options));
}

function useMultiSelect(p: SpecialCellEditorProps, options: readonly string[]) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const [selected, setSelected] = useState<string[]>(() => parseKnown(p.initialValue, options));
  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const joined = () => selected.join("|");
  return { finalize, selected, setSelected, toggle, joined };
}

/** Keyboard for a filtered option list with a search box: arrows move the
 *  highlight, Enter picks / toggles, Tab commits and moves sideways. */
function listKeys(
  nav: ReturnType<typeof useListNav>,
  filtered: readonly string[],
  onEnter: (v: string) => void,
  onTab: (dir: "left" | "right") => void,
) {
  return (e: React.KeyboardEvent) => {
    if (nav.onArrow(e)) return;
    const dir = tabDir(e);
    if (dir === "left" || dir === "right") {
      e.preventDefault();
      onTab(dir);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const v = filtered[nav.active];
      if (v) onEnter(v);
    }
  };
}

function Unrecognised({ values, noun }: { values: string[]; noun: string }) {
  if (values.length === 0) return null;
  return (
    <div className="mx-2 mt-2 px-2.5 py-2 rounded-lg shrink-0" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11.5, color: "#B91C1C", lineHeight: 1.4 }}>
      Not in Omne, so it is dropped when you save: {values.join(", ")}. Pick the {noun} it should be.
    </div>
  );
}

/* ═══ Base Unit of Measure: grouped, searchable, abbreviation badges ═══ */

export function UnitEditor(p: SpecialCellEditorProps) {
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const groups = useMemo(() => unitOptionGroups(), []);
  const all = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const current = canonicalIn(p.initialValue, all);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((g) => ({ label: g.label, options: q ? g.options.filter((o) => o.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)) : g.options }))
    .filter((g) => g.options.length > 0);
  const flat = filteredGroups.flatMap((g) => g.options);
  const nav = useListNav(flat.length, Math.max(0, flat.indexOf(current ?? "")));
  const onKeyDown = listKeys(
    nav,
    flat,
    (v) => finalize("commit", v),
    (dir) => finalize("commit", flat[nav.active] ?? p.initialValue, dir),
  );
  return (
    <EditorPopover
      trigger={
        <CellTrigger>
          {current ?? (p.initialValue || null)}
        </CellTrigger>
      }
      width={300}
      autoFocusContent={false}
      onDismiss={() => finalize("cancel")}
      onEscape={() => finalize("cancel")}
      onKeyDown={onKeyDown}
    >
      <PanelHeader title="Base Unit of Measure (UOM)" hint="The primary unit used for counting and valuing this item." />
      <SearchField value={query} onChange={(v) => { setQuery(v); nav.setActive(0); }} placeholder="Search units or categories..." />
      <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 300 }}>
        {flat.length === 0 && <EmptyResults query={query} />}
        {filteredGroups.map((g) => (
          <div key={g.label}>
            <SectionLabel>{g.label}</SectionLabel>
            {g.options.map((opt) => {
              const i = flat.indexOf(opt);
              const selected = current === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => finalize("commit", opt)}
                  onMouseEnter={() => nav.setActive(i)}
                  className="flex items-center gap-2 w-full px-2 rounded-lg transition-colors cursor-pointer outline-none"
                  style={{ height: 36, fontSize: 13, color: "#0F172A", backgroundColor: nav.active === i ? "#F1F5F9" : "transparent" }}
                >
                  <UnitBadge unit={opt} />
                  <span className="flex-1 text-left truncate">{opt}</span>
                  <UomTypePill unit={opt} />
                  {selected && <Check className="shrink-0" style={{ width: 14, height: 14, color: "#0A77FF" }} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </EditorPopover>
  );
}

/* ═══ Locations: LocationMultiSelect (search, checkbox rows, chips) ═══ */

const LOCATION_TITLES: Record<string, { title: string; hint: string }> = {
  inboundLocations: { title: "Inbound Locations", hint: "Where this item can be received and put away." },
  outboundLocations: { title: "Outbound Locations", hint: "Where this item can be picked and shipped from." },
  receivingStagingLocation: { title: "Receiving Staging Locations", hint: "Where received stock waits before put-away." },
  shippingStagingLocation: { title: "Shipping Staging Locations", hint: "Where picked stock waits before it ships." },
};

export function LocationsEditor(p: SpecialCellEditorProps) {
  const options = LIVE_LOCATIONS;
  const { finalize, selected, toggle, joined } = useMultiSelect(p, options);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const nav = useListNav(filtered.length, 0);
  const meta = LOCATION_TITLES[p.col.key] ?? { title: p.col.label, hint: "" };
  const unknown = unknownParts(p.initialValue, options);
  return (
    <EditorPopover
      trigger={<CellTrigger>{selected.length === 0 ? p.initialValue || null : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1} more`}</CellTrigger>}
      width={330}
      autoFocusContent={false}
      onDismiss={() => finalize("commit", joined())}
      onEscape={() => finalize("cancel")}
      onKeyDown={listKeys(nav, filtered, toggle, (dir) => finalize("commit", joined(), dir))}
    >
      <PanelHeader title={meta.title} hint={meta.hint} />
      <Unrecognised values={unknown} noun="location" />
      <SearchField value={query} onChange={(v) => { setQuery(v); nav.setActive(0); }} />
      <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 200 }}>
        {filtered.length === 0 && <EmptyResults query={query} />}
        {filtered.map((loc, i) => {
          const checked = selected.includes(loc);
          return (
            <button
              key={loc}
              type="button"
              onClick={() => toggle(loc)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-center gap-2 w-full px-2 rounded-lg transition-colors cursor-pointer outline-none"
              style={{ height: 36, fontSize: 12.5, color: "#0F172A", backgroundColor: nav.active === i ? "#F1F5F9" : "transparent" }}
            >
              <CheckBox checked={checked} />
              <span className="flex-1 text-left truncate">{loc}</span>
              {checked && <Check className="shrink-0" style={{ width: 12, height: 12, color: "#0A77FF" }} />}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-col gap-1.5 px-2.5 py-2 border-t border-[#F1F5F9] overflow-y-auto shrink-0" style={{ maxHeight: 140 }}>
          {selected.map((loc) => (
            <div key={loc} className="flex items-center gap-2 px-2.5" style={{ height: 30, borderRadius: 6, fontSize: 12, border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}>
              <span className="flex-1 truncate" style={{ color: "#475569" }}>{loc}</span>
              <button type="button" onClick={() => toggle(loc)} aria-label={`Remove ${loc}`} className="shrink-0 flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] cursor-pointer" style={{ width: 16, height: 16 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          ))}
        </div>
      )}
      <PanelFooter left={`${selected.length} selected`} onDone={() => finalize("commit", joined())} />
    </EditorPopover>
  );
}

/* ═══ Specific Partners: Select Customers picker ═══ */

export function PartnersEditor(p: SpecialCellEditorProps) {
  const options = LIVE_PARTNER_NAMES;
  const { finalize, selected, toggle, joined } = useMultiSelect(p, options);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q) || (PARTNER_PROFILE[o]?.address ?? "").toLowerCase().includes(q)) : options;
  const nav = useListNav(filtered.length, 0);
  const unknown = unknownParts(p.initialValue, options);
  return (
    <EditorPopover
      trigger={<CellTrigger>{selected.length === 0 ? p.initialValue || null : selected.join(" · ")}</CellTrigger>}
      width={400}
      autoFocusContent={false}
      onDismiss={() => finalize("commit", joined())}
      onEscape={() => finalize("cancel")}
      onKeyDown={listKeys(nav, filtered, toggle, (dir) => finalize("commit", joined(), dir))}
    >
      <PanelHeader title="Select Customers" hint="Choose the partners this item can be sold to." />
      {(p.row.sellingScope ?? "").trim().toLowerCase() !== "specific" && (
        <div className="mx-2 mt-2 px-2.5 py-2 rounded-lg shrink-0" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 11.5, color: "#92400E", lineHeight: 1.4 }}>
          Specific Partners apply only when Selling Scope is Specific.
        </div>
      )}
      <Unrecognised values={unknown} noun="partner" />
      <SearchField value={query} onChange={(v) => { setQuery(v); nav.setActive(0); }} placeholder="Search partners..." />
      <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 280 }}>
        {filtered.length === 0 && <EmptyResults query={query} />}
        {filtered.map((name, i) => {
          const prof = PARTNER_PROFILE[name];
          const checked = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-center gap-3 w-full px-2 py-2 rounded-lg transition-colors cursor-pointer outline-none text-left"
              style={{ backgroundColor: checked ? "#F5F9FF" : nav.active === i ? "#F8FAFC" : "transparent" }}
            >
              <CheckBox checked={checked} />
              <Initials text={prof?.code ?? name.charAt(0)} bg={prof?.color ?? "#1F2937"} color="#FFFFFF" size={32} />
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{name}</span>
                {prof && <span className="block truncate" style={{ fontSize: 11.5, color: "#64748B" }}>{prof.address}</span>}
              </span>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }}>
                Customer
              </span>
            </button>
          );
        })}
      </div>
      <PanelFooter left={`${selected.length} selected`} onDone={() => finalize("commit", joined())} />
    </EditorPopover>
  );
}

/* ═══ Owners: people picker with Suggested / All people ═══ */

function userMeta(name: string) {
  return ITEM_USERS.find((u) => u.name === name);
}

function PersonRow({ name, role, highlighted, checked, multi, onPick, onHover }: {
  name: string;
  role: string;
  highlighted: boolean;
  checked: boolean;
  multi: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const m = userMeta(name);
  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={onHover}
      className="flex items-center gap-3 w-full px-2.5 rounded-lg transition-colors cursor-pointer outline-none text-left"
      style={{ height: 48, backgroundColor: highlighted ? "#F1F5F9" : "transparent" }}
    >
      {multi && <CheckBox checked={checked} />}
      <Initials text={m?.initials ?? name.slice(0, 2).toUpperCase()} bg={m?.bg ?? "#F1F5F9"} color={m?.text ?? "#334155"} />
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", lineHeight: "16px" }}>{name}</span>
        <span className="block truncate" style={{ fontSize: 11, color: "#71717A", lineHeight: "14px" }}>{role}</span>
      </span>
      {!multi && checked && <Check className="shrink-0" style={{ width: 14, height: 14, color: "#0A77FF" }} />}
    </button>
  );
}

const OWNER_TITLES: Record<string, { title: string; hint: string }> = {
  "owners.materialHandling": { title: "Material Handling Owner", hint: "Notified when a receipt, putaway, pick, pack, ship, or stock movement task is generated." },
  "owners.purchasing": { title: "Purchasing Owner", hint: "Notified when a PO is raised, modified, or received for this item." },
  "owners.finance": { title: "Finance Owner", hint: "Notified for invoicing, cost updates, payments, and GL postings." },
};

export function OwnerEditor(p: SpecialCellEditorProps) {
  const multi = p.col.multi;
  const options = LIVE_USER_NAMES;
  const { finalize, selected, toggle, joined } = useMultiSelect(p, options);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const perms = OWNER_SLOT_PERMISSIONS[p.col.key] ?? [];
  const roleOf = (n: string) => MOCK_USERS.find((u) => u.name === n)?.role ?? "";
  const match = (n: string) => !q || n.toLowerCase().includes(q) || roleOf(n).toLowerCase().includes(q);
  const suggested = options.filter((n) => match(n) && (userMeta(n)?.permissions ?? []).some((x) => perms.includes(x)));
  const others = options.filter((n) => match(n) && !suggested.includes(n));
  const flat = [...suggested, ...others];
  const current = selected[0] ?? null;
  const nav = useListNav(flat.length, Math.max(0, flat.indexOf(current ?? "")));
  const meta = OWNER_TITLES[p.col.key] ?? { title: p.col.label, hint: "" };
  const unknown = unknownParts(p.initialValue, options);
  const pick = (n: string) => (multi ? toggle(n) : finalize("commit", n));
  const section = (label: string, names: string[]) =>
    names.length > 0 && (
      <div>
        <SectionLabel>{label}</SectionLabel>
        {names.map((n) => {
          const i = flat.indexOf(n);
          return (
            <PersonRow
              key={n}
              name={n}
              role={roleOf(n)}
              highlighted={nav.active === i}
              checked={selected.includes(n)}
              multi={multi}
              onPick={() => pick(n)}
              onHover={() => nav.setActive(i)}
            />
          );
        })}
      </div>
    );
  return (
    <EditorPopover
      trigger={<CellTrigger>{selected.length === 0 ? p.initialValue || null : selected.join(" · ")}</CellTrigger>}
      width={310}
      autoFocusContent={false}
      onDismiss={() => (multi ? finalize("commit", joined()) : finalize("cancel"))}
      onEscape={() => finalize("cancel")}
      onKeyDown={listKeys(nav, flat, pick, (dir) => finalize("commit", multi ? joined() : flat[nav.active] ?? p.initialValue, dir))}
    >
      <PanelHeader title={meta.title} hint={meta.hint} />
      <Unrecognised values={unknown} noun="person" />
      <SearchField value={query} onChange={(v) => { setQuery(v); nav.setActive(0); }} placeholder="Search people..." />
      <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 320 }}>
        {flat.length === 0 && <EmptyResults query={query} />}
        {section("Suggested", suggested)}
        {section("All people", others)}
      </div>
      {multi && <PanelFooter left={`${selected.length} selected`} onDone={() => finalize("commit", joined())} />}
    </EditorPopover>
  );
}

/* ═══ Approvers: checkbox rows with coloured initials, chips ═══ */

export function ApproversEditor(p: SpecialCellEditorProps) {
  const options = LIVE_APPROVER_NAMES;
  const { finalize, selected, toggle, joined } = useMultiSelect(p, options);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const roleOf = (n: string) => MOCK_APPROVERS.find((a) => a.name === n)?.role ?? "";
  const filtered = options.filter((n) => !q || n.toLowerCase().includes(q) || roleOf(n).toLowerCase().includes(q));
  const nav = useListNav(filtered.length, 0);
  const unknown = unknownParts(p.initialValue, options);
  return (
    <EditorPopover
      trigger={<CellTrigger>{selected.length === 0 ? p.initialValue || null : `${selected.length} approver${selected.length > 1 ? "s" : ""} selected`}</CellTrigger>}
      width={320}
      autoFocusContent={false}
      onDismiss={() => finalize("commit", joined())}
      onEscape={() => finalize("cancel")}
      onKeyDown={listKeys(nav, filtered, toggle, (dir) => finalize("commit", joined(), dir))}
    >
      <PanelHeader title="Approver" hint="Select who can approve adjustments when variance exceeds the threshold." />
      <Unrecognised values={unknown} noun="approver" />
      <SearchField value={query} onChange={(v) => { setQuery(v); nav.setActive(0); }} placeholder="Search approvers..." />
      <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 240 }}>
        {filtered.length === 0 && <EmptyResults query={query} />}
        {filtered.map((n, i) => {
          const m = APPROVER_META[n];
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              onMouseEnter={() => nav.setActive(i)}
              className="flex items-center gap-3 w-full px-2.5 rounded-lg transition-colors cursor-pointer outline-none text-left"
              style={{ height: 48, backgroundColor: nav.active === i ? "#F1F5F9" : "transparent" }}
            >
              <CheckBox checked={selected.includes(n)} />
              <Initials text={m?.initials ?? n.slice(0, 2).toUpperCase()} bg={m?.color ?? "#94A3B8"} color="#FFFFFF" square />
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", lineHeight: "16px" }}>{n}</span>
                <span className="block truncate" style={{ fontSize: 11, color: "#71717A", lineHeight: "14px" }}>{roleOf(n)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2.5 py-2 border-t border-[#F1F5F9] shrink-0">
          {selected.map((n) => {
            const m = APPROVER_META[n];
            return (
              <span key={n} className="inline-flex items-center gap-1.5 pl-1.5 pr-1" style={{ height: 26, borderRadius: 9999, background: "#F1F5F9", border: "0.75px solid #E2E8F0" }}>
                <Initials text={m?.initials ?? "?"} bg={m?.color ?? "#94A3B8"} color="#FFFFFF" size={18} square />
                <span style={{ fontSize: 11, fontWeight: 500, color: "#0F172A" }}>{n.split(" ")[0]}</span>
                <button type="button" onClick={() => toggle(n)} aria-label={`Remove ${n}`} className="flex items-center justify-center rounded-full hover:bg-[#E2E8F0] cursor-pointer" style={{ width: 16, height: 16 }}>
                  <X style={{ width: 10, height: 10, color: "#71717A" }} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <PanelFooter left={`${selected.length} selected`} onDone={() => finalize("commit", joined())} />
    </EditorPopover>
  );
}

/* ═══ Categories: the Category Selection step (card grid overlay) ═══ */

const CATEGORY_DESC = new Map(CATEGORIES.map((c) => [c.name, c.description]));

function CategoryCard({
  code,
  index,
  selected,
  primary,
  locked,
  highlighted,
  onClick,
  onHover,
}: {
  code: string;
  index: number;
  selected: boolean;
  primary: boolean;
  locked: boolean;
  highlighted: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      onMouseEnter={onHover}
      aria-disabled={locked || undefined}
      className="relative text-left p-3 rounded-lg border transition-all w-full outline-none"
      style={{
        cursor: locked ? "default" : "pointer",
        borderColor: selected ? "#0A77FF" : highlighted ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: selected ? "#F5F9FF" : highlighted ? "#FAFCFF" : "#FFFFFF",
        boxShadow: selected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : highlighted
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      <span className="absolute flex items-center gap-1" style={{ top: 8, right: 8 }}>
        {primary && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0A77FF] text-white" style={{ fontSize: 10, fontWeight: 600 }}>
            Primary
          </span>
        )}
        {selected ? (
          <span className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </span>
        ) : highlighted ? (
          <span className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
        ) : null}
      </span>
      <span className="w-7 h-7 rounded-md flex items-center justify-center mb-1.5" style={{ backgroundColor: selected ? "#D6E8FF" : "#F1F5F9" }}>
        <Icon className="w-4 h-4" style={{ color: selected ? "#0A77FF" : "#64748B" }} />
      </span>
      <span className="block pr-16" style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: "#0F172A" }}>{code}</span>
      <span className="block mt-0.5 line-clamp-2 pr-2" style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>
        {CATEGORY_DESC.get(code) ?? ""}
      </span>
    </button>
  );
}

const GRID_COLS = 3;

export function CategoryEditor(p: SpecialCellEditorProps) {
  const multi = p.col.key === "additionalCategories";
  const options = LIVE_CATEGORY_CODES;
  const finalize = useFinalize(p.initialValue, p.onCommit, p.onCancel);
  const primary = multi ? canonicalIn(p.row.primaryCategory ?? "", options) : null;
  const [selected, setSelected] = useState<string[]>(() => parseKnown(p.initialValue, options).filter((c) => c !== primary));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = options.filter((c) => !q || c.toLowerCase().includes(q) || (CATEGORY_DESC.get(c) ?? "").toLowerCase().includes(q));
  const current = !multi ? canonicalIn(p.initialValue, options) : null;
  const [active, setActive] = useState(() => Math.max(0, filtered.indexOf(current ?? "")));
  const unknown = unknownParts(p.initialValue, options);
  const joined = () => selected.join("|");
  const toggle = (c: string) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const pick = (c: string) => {
    if (multi) {
      if (c !== primary) toggle(c);
    } else finalize("commit", c, null);
  };
  const close = () => (multi ? finalize("commit", joined(), null) : finalize("cancel"));
  const searchRef = useRef<HTMLInputElement>(null);
  /* The overlay owns the keyboard while it is up: take focus after the grid
     settles, and let Escape close it even if focus drifted outside. */
  useEffect(() => {
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finalize("cancel");
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = filtered.length;
    const move = (d: number) => {
      e.preventDefault();
      setActive((i) => Math.min(Math.max(0, i + d), Math.max(0, n - 1)));
    };
    if (e.key === "ArrowRight") move(1);
    else if (e.key === "ArrowLeft") move(-1);
    else if (e.key === "ArrowDown") move(GRID_COLS);
    else if (e.key === "ArrowUp") move(-GRID_COLS);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      finalize("commit", multi ? joined() : filtered[active] ?? p.initialValue, e.shiftKey ? "left" : "right");
    }
  };

  const display = multi ? (selected.length ? selected.join(" · ") : p.initialValue || null) : current ?? (p.initialValue || null);

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-1.5 w-full h-full cursor-pointer text-left outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px", color: display ? "#1E293B" : "#94A3B8" }}
      >
        {multi && primary && <Star className="w-3 h-3 shrink-0" style={{ color: "#0A77FF", fill: "#0A77FF" }} />}
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{display ?? "- Select -"}</span>
      </button>
      {createPortal(
        <div
          data-cell-dropdown
          className="fixed inset-0 z-[330] flex items-center justify-center"
          style={{ fontFamily: CELL_FONT }}
          onKeyDown={onKeyDown}
        >
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div
            role="dialog"
            aria-label={multi ? "Select additional categories" : "Select primary category"}
            className="relative bg-white rounded-xl border border-[#E2E8F0] shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] flex flex-col"
            style={{ width: "min(880px, calc(100vw - 48px))", maxHeight: "min(640px, calc(100vh - 48px))" }}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[#F1F5F9]">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{multi ? "Additional Categories" : "Primary Category"}</div>
                <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                  {multi
                    ? "Choose one or more categories. The primary category drives item defaults and is set in its own column."
                    : "Choose the category that drives this item's defaults."}
                </div>
              </div>
              <button type="button" onClick={() => finalize("cancel")} aria-label="Close" className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#F1F5F9] cursor-pointer">
                <X className="w-4 h-4" style={{ color: "#64748B" }} />
              </button>
            </div>
            <div className="px-5 pt-3">
              <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[#E2E8F0] focus-within:border-[#0A77FF] transition-colors">
                <Search className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
                <input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  placeholder="Search categories..."
                  className="flex-1 min-w-0 bg-transparent outline-none"
                  style={{ fontSize: 14, color: "#1E293B" }}
                />
              </div>
              {(multi ? selected.length > 0 || primary : false) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {primary && (
                    <span className="inline-flex items-center gap-1 px-2 rounded-md border" style={{ height: 24, fontSize: 11.5, fontWeight: 500, color: "#0A77FF", backgroundColor: "#EDF4FF", borderColor: "#BFDBFE" }}>
                      <Star className="w-3 h-3" style={{ fill: "#0A77FF" }} />
                      {primary}
                    </span>
                  )}
                  {selected.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 pl-2 pr-1 rounded-md border" style={{ height: 24, fontSize: 11.5, color: "#334155", backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }}>
                      {c}
                      <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c}`} className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#F1F5F9] cursor-pointer">
                        <X className="w-3 h-3" style={{ color: "#94A3B8" }} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {unknown.length > 0 && (
                <div className="mt-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11.5, color: "#B91C1C" }}>
                  Not in Omne, so it is dropped when you save: {unknown.join(", ")}. Pick the category it should be.
                </div>
              )}
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 8 }}>{filtered.length} categories available</div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
              {filtered.length === 0 ? (
                <EmptyResults query={query} />
              ) : (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
                  {filtered.map((c, i) => (
                    <CategoryCard
                      key={c}
                      code={c}
                      index={options.indexOf(c)}
                      selected={multi ? selected.includes(c) || c === primary : c === current}
                      primary={multi ? c === primary : c === current}
                      locked={multi && c === primary}
                      highlighted={active === i}
                      onClick={() => pick(c)}
                      onHover={() => setActive(i)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#F1F5F9]">
              <span style={{ fontSize: 12, color: "#64748B" }}>
                {multi ? `${selected.length} selected` : "Arrow keys to move, Enter to pick"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => finalize("cancel")}
                  className="h-9 px-4 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] cursor-pointer"
                  style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}
                >
                  Cancel
                </button>
                {multi && (
                  <button
                    type="button"
                    onClick={() => finalize("commit", joined(), null)}
                    className="h-9 px-4 rounded-md bg-[#0A77FF] hover:bg-[#0066D6] text-white cursor-pointer"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
