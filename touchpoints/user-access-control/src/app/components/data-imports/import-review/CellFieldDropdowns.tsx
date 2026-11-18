/* ────────────────────────────────────────────────────────────
   Inline cell dropdowns for the Import Review grid + Import
   Record detail grid. These replace the OS-level <select> that
   used to back the License Type / Status / Assigned Roles cells
   with dropdowns styled to the UAC design system.

   All three mount already-open (the cell only renders them while
   it's being edited) and portal their panel to <body>, so they
   carry a `data-cell-dropdown` marker that the grids' outside-
   click handlers whitelist (a click inside the panel must not be
   read as "clicked outside the cell").

   • LicenseCellDropdown  – single select, the plain Status list
     with each tier's per-user price as a second line.
   • SimpleCellDropdown   – single select, plain option list
     (used by Status).
   License, Simple and Options all render ChoiceCellDropdown.
   • RolesCellDropdown    – multi select, sectioned into Custom
     Roles and Predefined Roles, mirroring the roles catalog.
   ──────────────────────────────────────────────────────────── */
import { useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, ChevronDown, ExternalLink, Search, X } from "lucide-react";
import { Checkbox } from "../../ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { roles as ROLE_CATALOG, ROLE_GROUP_LABELS } from "../../../data/roles-data";
import { ChoiceCellDropdown } from "./ChoiceCellDropdown";

/* Shared type for the finalize contract the CellInput expects. */
type NavDir = "up" | "down" | "left" | "right";
interface CellFieldProps {
  value: string;
  onCommit: (next: string, dir?: NavDir) => void;
  onCancel: () => void;
}

/* Panel chrome shared by every cell dropdown, matches the density /
 * bulk-set dropdowns already used across the import screens. */
const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

const CELL_FONT =
  "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";

/* ─── License config ──────────────────────────────────────────
 * Accent + pricing per the design system's LicenseDropdown. Daily
 * rates ($5.00 Full Access / $0.50 Field User) come from
 * LicenseReviewBody; the monthly figure is the 30-day cycle. */
interface LicenseOption {
  key: string;
  label: string;
  price: string;
}
const LICENSE_OPTIONS: LicenseOption[] = [
  { key: "Full Access", label: "Full Access", price: "$150 / user · month" },
  { key: "Field User",  label: "Field User",  price: "$15 / user · month" },
  { key: "No License",  label: "No License",  price: "Free · not billed" },
];

/* ─── Shared trigger button that fills the editing cell ─── */
function CellTrigger({
  children,
  placeholder,
  isPlaceholder,
}: {
  children: React.ReactNode;
  placeholder?: string;
  isPlaceholder?: boolean;
}) {
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
      >
        <span
          className="block overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ color: isPlaceholder ? "#94A3B8" : "#1E293B" }}
        >
          {isPlaceholder ? placeholder : children}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

/* ════════════════════════════════════════════════════════════
   License Type — single select, tinted tier cards + pricing
   ════════════════════════════════════════════════════════════ */
export function LicenseCellDropdown({ value, onCommit, onCancel }: CellFieldProps) {
  /* The Status list with each tier's price as its second line: plain text in
   * the cell, no tinted chip, no swatches. */
  return (
    <ChoiceCellDropdown
      value={value}
      options={LICENSE_OPTIONS.map((o) => ({ value: o.key, label: o.label, description: o.price }))}
      label="License Type"
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}

/* ════════════════════════════════════════════════════════════
   Generic single select — plain option list (Status)
   ════════════════════════════════════════════════════════════ */
export function SimpleCellDropdown({
  value,
  options,
  onCommit,
  onCancel,
}: CellFieldProps & { options: string[] }) {
  return <ChoiceCellDropdown value={value} options={options} onCommit={onCommit} onCancel={onCancel} />;
}

/* ════════════════════════════════════════════════════════════
   Assigned Roles — multi select, sectioned Custom / Predefined
   ════════════════════════════════════════════════════════════ */

/* Catalog split, sourced from roles-data so it never drifts from
 * the Roles listing. Archived roles are omitted (not assignable), and so is
 * the Account Owner: only OMNE changes who holds it. */
const ROLE_SECTIONS: { label: string; names: string[] }[] = (() => {
  const assignable = ROLE_CATALOG.filter((r) => r.status !== "Archived" && !r.isProtected);
  const custom = assignable.filter((r) => !r.isSystem).map((r) => r.roleName).sort((a, b) => a.localeCompare(b));
  const predefined = assignable.filter((r) => r.isSystem).map((r) => r.roleName).sort((a, b) => a.localeCompare(b));
  return [
    { label: ROLE_GROUP_LABELS.custom, names: custom },
    { label: ROLE_GROUP_LABELS.system, names: predefined },
  ];
})();

const CANONICAL_BY_LOWER = new Map<string, string>(
  ROLE_CATALOG.map((r) => [r.roleName.toLowerCase(), r.roleName]),
);

/* Role name → detail-page URL, so each option can deep-link to its
 * role in a new tab. Names not in the catalog resolve to null. */
const ROLE_ID_BY_LOWER = new Map<string, number>(
  ROLE_CATALOG.map((r) => [r.roleName.toLowerCase(), r.id]),
);

function roleDetailHref(name: string): string | null {
  const id = ROLE_ID_BY_LOWER.get(name.toLowerCase());
  return id == null ? null : `/company-settings/user-access-control/role/${id}`;
}

function parseRoles(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split("|")) {
    const token = raw.trim();
    if (!token) continue;
    const canonical = CANONICAL_BY_LOWER.get(token.toLowerCase()) ?? token;
    const lower = canonical.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(canonical);
  }
  return out;
}

export function RolesCellDropdown({ value, onCommit, onCancel }: CellFieldProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string[]>(() => parseRoles(value));
  const [query, setQuery] = useState("");
  const finalizedRef = useRef(false);

  const finalize = (mode: "commit" | "cancel", next: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (mode === "cancel") onCancel();
    else onCommit(next, "down");
  };

  const isChecked = (name: string) =>
    selected.some((s) => s.toLowerCase() === name.toLowerCase());

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.some((s) => s.toLowerCase() === name.toLowerCase())
        ? prev.filter((s) => s.toLowerCase() !== name.toLowerCase())
        : [...prev, name],
    );
  };

  const q = query.trim().toLowerCase();
  const filteredSections = ROLE_SECTIONS.map((section) => ({
    label: section.label,
    names: q ? section.names.filter((n) => n.toLowerCase().includes(q)) : section.names,
  })).filter((s) => s.names.length > 0);

  const hasResults = filteredSections.length > 0;

  const triggerLabel = selected.length === 0 ? null : selected.join(" · ");

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) finalize("commit", selected.join(" | ")); // dismiss commits accumulated picks
      }}
    >
      <CellTrigger placeholder="- Select roles -" isPlaceholder={selected.length === 0}>
        {triggerLabel}
      </CellTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className={`${PANEL_CLASS} w-[288px] flex flex-col`}
          onEscapeKeyDown={() => finalize("cancel", value)}
        >
          {/* Search */}
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0A77FF] focus-within:bg-white transition-colors">
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search roles"
                className="flex-1 min-w-0 bg-transparent outline-none"
                style={{ fontFamily: CELL_FONT, fontSize: "13px", color: "#1E293B" }}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="shrink-0 cursor-pointer" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-[248px] overflow-y-auto py-1.5">
            {!hasResults && (
              <div className="px-3 py-6 text-center" style={{ fontFamily: CELL_FONT, fontSize: "12.5px", color: "#94A3B8" }}>
                No roles match “{query}”
              </div>
            )}

            {filteredSections.map((section) => (
              <RoleSection key={section.label} label={section.label}>
                {section.names.map((name) => (
                  <RoleRow key={name} name={name} checked={isChecked(name)} onToggle={() => toggle(name)} href={roleDetailHref(name)} />
                ))}
              </RoleSection>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
            <span style={{ fontFamily: CELL_FONT, fontSize: "12px", color: "#64748B" }}>
              {selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                finalize("commit", selected.join(" | "));
                setOpen(false);
              }}
              className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
              style={{ fontFamily: CELL_FONT, fontSize: "12.5px", fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function RoleSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1.5 pb-1">
      <div
        className="px-2 pt-2 pb-1 uppercase tracking-wide"
        style={{ fontFamily: CELL_FONT, fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function RoleRow({
  name,
  checked,
  onToggle,
  href,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  href?: string | null;
}) {
  return (
    <div
      className="group flex items-center gap-1 w-full px-2 py-1.5 rounded-lg transition-colors"
      style={{ backgroundColor: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
      >
        <Checkbox checked={checked} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} className="shrink-0" />
        <span
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontFamily: CELL_FONT, fontSize: "13px", color: "#0F172A", fontWeight: 450 }}
        >
          {name}
        </span>
      </button>
      {href && (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="View role details"
              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#EFF6FF] transition-opacity cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
            </a>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="z-[340] bg-white border border-[#E2E8F0] text-[#0F172A] px-2.5 py-1.5 rounded-lg shadow-lg"
            style={{ fontFamily: CELL_FONT, fontSize: "12px", fontWeight: 500 }}
          >
            View role details
            <TooltipPrimitive.Arrow
              width={10}
              height={5}
              style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }}
            />
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Searchable options — the Assigned Roles panel (search, option
   rows, footer) for any column: multi select joins picks with a
   pipe, single select commits on click. Used by the module
   imports (Items, Categories, Partners, Partner Groups).
   ════════════════════════════════════════════════════════════ */
export function OptionsCellDropdown({
  value,
  options,
  multi,
  label,
  onCommit,
  onCancel,
}: CellFieldProps & { options: string[]; multi: boolean; label?: string }) {
  return <ChoiceCellDropdown value={value} options={options} multi={multi} searchable label={label} onCommit={onCommit} onCancel={onCancel} />;
}
