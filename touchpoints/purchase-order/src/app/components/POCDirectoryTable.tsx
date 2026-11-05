import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { FONT } from "./designTokens";
import {
  CONTACT_DICTIONARY,
  enrichContacts,
  DEPT_STYLES,
  ENTITY_TYPE_META,
  shortDept,
  getInitials,
  type EnrichedContact,
} from "./pocDirectoryData";

/**
 * POCDirectoryTable — port of Partners' Contacts Directory table
 * (`Partners/.../ContactsDirectoryPage.tsx:1288-1779`) trimmed to the
 * 11 columns the PO Detail flow needs (`contact_name`, `role`,
 * `department`, `company`, `phones`, `emails`, `socials`,
 * `linked_partners`, `linked_entities`, `created_by`, `created_on` —
 * `locations` + `status` deliberately omitted per spec).
 *
 * Differences from the Partners renderer:
 *   - No HoverCard / QuickView popover on names — those depend on
 *     VendorContext + quick-view modal infra that doesn't live on the
 *     PO Detail page. The avatar + name still render the same way.
 *   - Bulk-action floating row is omitted by design. Selection state is
 *     bubbled up via `selectedIds` / `onSelectionChange` so the host
 *     modal can render its own footer affordance instead.
 *   - "+N more" overflow indicator uses a plain `Tooltip` listing the
 *     remaining values, rather than the rich `OverflowTooltip` modal
 *     popover Partners ships.
 *
 * Visual recipe (sticky header, hover row, density, dept pills,
 * 2-letter entity tiles) is preserved verbatim.
 */

/* ─── Column definitions (locations + status omitted) ─── */
const COLUMNS: { key: string; label: string; minWidth: number }[] = [
  { key: "contact_name", label: "Contact", minWidth: 240 },
  { key: "role", label: "Title", minWidth: 200 },
  { key: "department", label: "Department", minWidth: 180 },
  { key: "company", label: "Company", minWidth: 220 },
  { key: "phones", label: "Phone", minWidth: 220 },
  { key: "emails", label: "Email", minWidth: 240 },
  { key: "socials", label: "Social", minWidth: 200 },
  { key: "linked_partners", label: "Linked Partners", minWidth: 220 },
  { key: "linked_entities", label: "Linked Entities", minWidth: 200 },
  { key: "created_by", label: "Created By", minWidth: 200 },
  { key: "created_on", label: "Created On", minWidth: 130 },
];

/* ─── Avatar — hash-derived colored circle with initials ─── */
function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  // Deterministic hash → palette index
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const palette = [
    { bg: "#EFF6FF", fg: "#1E40AF" }, // blue
    { bg: "#F5F3FF", fg: "#6D28D9" }, // violet
    { bg: "#ECFDF5", fg: "#065F46" }, // emerald
    { bg: "#FEF3C7", fg: "#92400E" }, // amber
    { bg: "#FDF2F8", fg: "#9D174D" }, // pink
    { bg: "#ECFEFF", fg: "#155E75" }, // cyan
  ];
  const idx = Math.abs(h) % palette.length;
  const { bg, fg } = palette[idx];
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
    >
      {getInitials(name)}
    </div>
  );
}

/* ─── "+N more" pill that exposes the remaining list via a Tooltip ─── */
function OverflowPill({
  count,
  category,
  items,
}: {
  count: number;
  category: string;
  items: string[];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-[11px] shrink-0 cursor-default leading-none"
          style={{ fontWeight: 600, color: "#085FCC" }}
        >
          +{count} more
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[260px] z-[300]">
        <div className="text-[10px] uppercase tracking-wide text-slate-300 mb-1" style={{ fontWeight: 600 }}>
          {category}
        </div>
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="text-[11px] text-white truncate">
              {it}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Cell renderers — keyed off colKey ─── */
function renderCell(
  contact: EnrichedContact,
  colKey: string,
): React.ReactNode {
  switch (colKey) {
    case "contact_name": {
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={contact.name} size={28} />
          <div className="min-w-0">
            <span
              className="text-[13px] truncate text-slate-800 block"
              style={{ fontWeight: 500, fontFamily: FONT }}
              title={contact.name}
            >
              {contact.name}
            </span>
          </div>
        </div>
      );
    }
    case "role":
      return (
        <span className="text-[13px] text-foreground" style={{ fontFamily: FONT }}>
          {contact.role || "—"}
        </span>
      );
    case "department": {
      const depts = contact.departments || [contact.department];
      const first = shortDept(depts[0]);
      const style = DEPT_STYLES[depts[0]] || {
        bg: "hsl(var(--muted))",
        text: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
      };
      return (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px]"
            style={{
              fontWeight: 500,
              backgroundColor: style.bg,
              color: style.text,
              borderColor: style.border,
              fontFamily: FONT,
            }}
          >
            {first}
          </span>
          {depts.length > 1 && (
            <OverflowPill
              count={depts.length - 1}
              category="Departments"
              items={depts.slice(1).map(shortDept)}
            />
          )}
        </div>
      );
    }
    case "company": {
      const comps = contact.companies || [contact.company];
      return (
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] truncate" style={{ fontFamily: FONT }} title={comps[0]}>
            {comps[0]}
          </span>
          {comps.length > 1 && (
            <OverflowPill count={comps.length - 1} category="Companies" items={comps.slice(1)} />
          )}
        </div>
      );
    }
    case "phones": {
      const phones = contact.phones || [];
      if (phones.length === 0) {
        return (
          <span className="text-[13px] text-muted-foreground" style={{ fontFamily: FONT }}>
            —
          </span>
        );
      }
      const first = phones[0];
      const extra = phones.length - 1;
      const display = `${first.code} ${first.number}${first.ext ? ` ext. ${first.ext}` : ""}`;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] tabular-nums truncate" style={{ fontWeight: 500, fontFamily: FONT }}>
            {display}
          </span>
          {extra > 0 && (
            <OverflowPill
              count={extra}
              category="Phone Numbers"
              items={phones
                .slice(1)
                .map((p) => `${p.type} · ${p.code} ${p.number}${p.ext ? ` ext. ${p.ext}` : ""}`)}
            />
          )}
        </div>
      );
    }
    case "emails": {
      const emails = contact.emails || [];
      if (emails.length === 0) {
        return (
          <span className="text-[13px] text-muted-foreground" style={{ fontFamily: FONT }}>
            —
          </span>
        );
      }
      const first = emails[0];
      const extra = emails.length - 1;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] text-foreground truncate" style={{ fontFamily: FONT }} title={first.address}>
            {first.address}
          </span>
          {extra > 0 && (
            <OverflowPill
              count={extra}
              category="Email Addresses"
              items={emails.slice(1).map((e) => `${e.type} · ${e.address}`)}
            />
          )}
        </div>
      );
    }
    case "socials": {
      const socials = contact.socials || [];
      if (socials.length === 0) {
        return (
          <span className="text-[13px] text-muted-foreground" style={{ fontFamily: FONT }}>
            —
          </span>
        );
      }
      const first = socials[0];
      const extra = socials.length - 1;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[13px] truncate cursor-pointer hover:text-primary hover:underline transition-colors"
            style={{ fontWeight: 500, fontFamily: FONT }}
            title={first.url}
          >
            {first.url}
          </span>
          {extra > 0 && (
            <OverflowPill
              count={extra}
              category="Social Profiles"
              items={socials.slice(1).map((s) => `${s.type} · ${s.url}`)}
            />
          )}
        </div>
      );
    }
    case "linked_partners": {
      const partners = contact.linkedPartners;
      const extra = partners.length - 1;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[13px] cursor-pointer hover:text-primary hover:underline transition-colors truncate"
            style={{ fontWeight: 500, fontFamily: FONT }}
            title={partners[0]}
          >
            {partners[0]}
          </span>
          {extra > 0 && (
            <OverflowPill count={extra} category="Linked Partners" items={partners.slice(1)} />
          )}
        </div>
      );
    }
    case "linked_entities": {
      const ents = contact.linkedEntities;
      if (ents.length === 0) {
        return (
          <span className="text-[13px] text-muted-foreground" style={{ fontFamily: FONT }}>
            —
          </span>
        );
      }
      const first = ents[0];
      const extra = ents.length - 1;
      const uniqueTypes: string[] = [];
      for (const e of ents) {
        if (!uniqueTypes.includes(e.entityType)) uniqueTypes.push(e.entityType);
      }
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {uniqueTypes.map((t) => {
            const m = ENTITY_TYPE_META[t as keyof typeof ENTITY_TYPE_META];
            return (
              <span
                key={t}
                className="inline-flex items-center justify-center rounded px-1 h-4 text-[9.5px] shrink-0 tracking-wide"
                style={{ fontWeight: 700, backgroundColor: m.bg, color: m.color, fontFamily: FONT }}
                title={t}
              >
                {m.code}
              </span>
            );
          })}
          <span
            className="text-[13px] cursor-pointer hover:text-primary hover:underline transition-colors truncate tabular-nums"
            style={{ fontWeight: 500, fontFamily: FONT }}
            title={`${first.entityType} · ${first.refNo}`}
          >
            {first.refNo}
          </span>
          {extra > 0 && (
            <OverflowPill
              count={extra}
              category="Linked Entities"
              items={ents.slice(1).map((e) => `${e.entityType} · ${e.refNo}`)}
            />
          )}
        </div>
      );
    }
    case "created_by": {
      return (
        <div className="flex items-center gap-2">
          <Avatar name={contact.createdByName} size={24} />
          <span className="text-[13px] truncate" style={{ fontFamily: FONT }} title={contact.createdByName}>
            {contact.createdByName}
          </span>
        </div>
      );
    }
    case "created_on":
      return (
        <span className="text-[13px]" style={{ fontFamily: FONT }}>
          {contact.createdOn}
        </span>
      );
  }
  return null;
}

/* ─── Component ─── */
export interface POCDirectoryTableProps {
  /** Optional override for the source dataset. Defaults to the full curated dictionary. */
  contacts?: typeof CONTACT_DICTIONARY;
  /** Search query — narrows by name / role / company / email. */
  searchQuery?: string;
  /** Multi-select state — controlled. */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function POCDirectoryTable({
  contacts,
  searchQuery = "",
  selectedIds,
  onSelectionChange,
}: POCDirectoryTableProps) {
  // Enrich once per mount — deterministic so React.memo is safe if we wrap later
  const enriched = useMemo(
    () => enrichContacts(contacts || CONTACT_DICTIONARY),
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q)
      );
    });
  }, [enriched, searchQuery]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someFilteredSelected =
    !allFilteredSelected && filtered.some((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      filtered.forEach((c) => next.delete(c.id));
    } else {
      filtered.forEach((c) => next.add(c.id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const totalMinWidth = 48 + COLUMNS.reduce((s, c) => s + c.minWidth, 0);

  return (
    <div className="w-full h-full overflow-auto" style={{ fontFamily: FONT }}>
      <table className="border-collapse" style={{ width: "100%", minWidth: totalMinWidth }}>
        <thead className="sticky top-0 z-[1] bg-slate-50">
          <tr className="border-b border-slate-200">
            <th
              className="px-3 py-2 text-left"
              style={{ width: 48, minWidth: 48 }}
            >
              <button
                type="button"
                onClick={toggleAll}
                aria-label={allFilteredSelected ? "Deselect all" : "Select all"}
                className={`size-4 rounded-[4px] border inline-flex items-center justify-center transition-colors ${
                  allFilteredSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : someFilteredSelected
                      ? "bg-primary/30 border-primary"
                      : "bg-white border-slate-300 hover:border-slate-400"
                }`}
              >
                {(allFilteredSelected || someFilteredSelected) && (
                  <Check className="size-3" strokeWidth={3} />
                )}
              </button>
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500 whitespace-nowrap"
                style={{ minWidth: col.minWidth, fontWeight: 600 }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="py-16 text-center">
                <p className="text-[13px] text-slate-500" style={{ fontWeight: 500 }}>
                  No contacts match your search.
                </p>
              </td>
            </tr>
          ) : (
            filtered.map((contact) => {
              const selected = selectedIds.has(contact.id);
              return (
                <tr
                  key={contact.id}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${
                    selected ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-slate-50"
                  }`}
                  onClick={() => toggleOne(contact.id)}
                >
                  <td className="px-3 py-2.5" style={{ width: 48 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOne(contact.id);
                      }}
                      aria-label={selected ? "Deselect" : "Select"}
                      className={`size-4 rounded-[4px] border inline-flex items-center justify-center transition-colors ${
                        selected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-white border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {selected && <Check className="size-3" strokeWidth={3} />}
                    </button>
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2.5 align-middle text-slate-800"
                      style={{ minWidth: col.minWidth }}
                    >
                      {renderCell(contact, col.key)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
