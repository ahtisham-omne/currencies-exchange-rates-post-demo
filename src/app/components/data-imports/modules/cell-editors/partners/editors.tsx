/* The Partners / Partner Group cell pickers. Each one mirrors the control the
 * matching field uses in partner-management-module's Create Partner and
 * Create Partner Group flows, re-expressed in UAC hex tokens, and commits the
 * import's text vocabulary (option labels, pipe-joined for lists) so the
 * partners validator (modules/partners/validation.ts) reads it unchanged. */
import { useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  CircleDollarSign,
  Cog,
  CreditCard,
  FileText,
  Globe,
  Handshake,
  Info,
  Landmark,
  Lock,
  Receipt,
  Settings2,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  Check,
} from "lucide-react";
import type { SpecialCellEditorProps } from "../registry";
import { CARRIERS, PAYMENT_METHODS } from "../../partners/spec.data.mjs";
import { canonicalOption, joinList, splitList } from "../../partners/spec";
import {
  PICKER_CONTACTS,
  PICKER_CURRENCIES,
  PICKER_GROUPS,
  PICKER_PAYMENT_TERMS,
  PICKER_PAYMENT_TYPES,
  PICKER_PRICING_RULES,
  type PickerGroup,
} from "./pickerData";
import {
  CellOverlay,
  CellPopover,
  CheckMark,
  MultiFooter,
  Radio,
  SearchBox,
  SectionLabel,
  UnknownPicks,
  hasIn,
  initials,
  panelKeys,
  sameText,
  toggleIn,
  useFinalize,
  useListHighlight,
} from "./shell";

type Editor = ComponentType<SpecialCellEditorProps>;

/* ─── helpers ─── */

function optionsOf(p: SpecialCellEditorProps): string[] {
  return p.col.options ?? [];
}

/** Current cell value as canonical option labels (unknown values kept as typed). */
function currentList(p: SpecialCellEditorProps, options: readonly string[] = optionsOf(p)): string[] {
  return splitList(p.initialValue).map((v) => canonicalOption(v, options) ?? v);
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-[#FEF3C7] text-inherit rounded-[2px] px-[1px]">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const matches = (q: string, ...fields: (string | undefined)[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => (f ?? "").toLowerCase().includes(needle));
};

function ListFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-2 mb-2 mt-1 flex items-start gap-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-2" style={{ fontSize: "11.5px", color: "#92400E" }}>
      <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>{children}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Status — Active / Inactive, the listing's status badge
   ════════════════════════════════════════════════════════════ */
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", dot: "#10B981" },
  inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#F59E0B" },
};

export const StatusEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const current = canonicalOption(p.initialValue, options);
  const list = useListHighlight(options.length, Math.max(0, options.findIndex((o) => o === current)));
  const badge = (label: string) => {
    const s = STATUS_STYLE[label.toLowerCase()];
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 whitespace-nowrap"
        style={{ fontSize: "12px", fontWeight: 500, backgroundColor: s?.bg, color: s?.text, borderColor: s?.border }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s?.dot }} />
        {label}
      </span>
    );
  };
  return (
    <CellPopover
      fin={fin}
      width={200}
      trigger={current ? badge(current) : p.initialValue || null}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => {
        list.onKeyDown(e, (i) => commit(options[i]));
        panelKeys(e, () => options[list.index] ?? p.initialValue, commit);
      }}
      className="p-1.5"
    >
      {options.map((opt, i) => {
        const selected = opt === current;
        return (
          <button
            key={opt}
            type="button"
            onMouseEnter={() => list.setIndex(i)}
            onClick={() => commit(opt)}
            className="flex items-center gap-3 w-full text-left px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: list.index === i ? "#F8FAFC" : "transparent" }}
          >
            <span className="flex-1 min-w-0">{badge(opt)}</span>
            {selected && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
          </button>
        );
      })}
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Partner Type / Group Scope — the Vendor and Customer cards
   ════════════════════════════════════════════════════════════ */
const TYPE_CARDS = [
  {
    key: "Vendor", sub: "Supplies goods or services", Icon: Truck,
    on: { border: "#7AB8FF", tint: "#EFF6FF", title: "#1E40AF", sub: "#3D98FF", tile: "#DBEAFE", icon: "#086AE6", check: "#0A77FF" },
  },
  {
    key: "Customer", sub: "Purchases goods or services", Icon: ShoppingCart,
    on: { border: "#C4B5FD", tint: "#F5F3FF", title: "#5B21B6", sub: "#A78BFA", tile: "#EDE9FE", icon: "#7C3AED", check: "#8B5CF6" },
  },
] as const;

export const PartnerTypeEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const [picked, setPicked] = useState(() => currentList(p));
  const known = TYPE_CARDS.map((c) => c.key);
  const value = () => joinList([...known.filter((k) => hasIn(picked, k)), ...picked.filter((v) => !hasIn(known, v))]);
  return (
    <CellPopover
      fin={fin}
      width={320}
      trigger={picked.length ? picked.join(" · ") : null}
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
    >
      <div className="px-3 pt-3 pb-2">
        <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{p.col.label}</p>
        <p className="text-[11px] text-[#94A3B8] mt-px">Select one or more partner classifications</p>
      </div>
      <UnknownPicks picked={picked} known={known} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
      <div className="px-2 pb-2 flex flex-col gap-2">
        {TYPE_CARDS.map((c) => {
          const on = hasIn(picked, c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setPicked((prev) => toggleIn(prev, c.key))}
              className="relative flex items-center gap-3 pl-3.5 pr-3 py-3 rounded-xl border text-left cursor-pointer transition-all"
              style={{
                borderColor: on ? `${c.on.border}B3` : "#E2E8F0",
                background: on ? `linear-gradient(135deg, ${c.on.tint} 0%, #FFFFFF 70%)` : "#FFFFFF",
              }}
            >
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: c.on.tile, color: c.on.icon }}>
                <c.Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px]" style={{ fontWeight: 600, color: on ? c.on.title : "#0F172A" }}>{c.key}</span>
                <span className="block text-[11px] mt-0.5" style={{ color: on ? c.on.sub : "#94A3B8" }}>{c.sub}</span>
              </span>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={on ? { backgroundColor: c.on.check } : { border: "1.5px solid #D1D5DB", backgroundColor: "#FFFFFF" }}
              >
                {on && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
        <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
      </div>
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Vendor / Customer profiles — the Profiles sidebar entries
   ════════════════════════════════════════════════════════════ */
const PROFILE_META: Record<string, { Icon: ComponentType<{ className?: string }>; comingSoon?: boolean }> = {
  "Vendor Rules": { Icon: Settings2 },
  Carrier: { Icon: Truck },
  "Online Vendor": { Icon: Globe, comingSoon: true },
  "In-Store Vendor": { Icon: Store, comingSoon: true },
  "Sub Contractor": { Icon: Wrench, comingSoon: true },
  "Service Provider": { Icon: Cog, comingSoon: true },
  "Customer Rules": { Icon: Settings2 },
  "Wholesale Buyer": { Icon: Building2, comingSoon: true },
  Distributor: { Icon: Truck, comingSoon: true },
  "End Consumer": { Icon: UserCheck, comingSoon: true },
  "B2B Client": { Icon: Briefcase, comingSoon: true },
  Reseller: { Icon: Handshake, comingSoon: true },
};

/** `typeColumn` is the row's Partner Type / Group Scope column, `side` the type these profiles belong to. */
export function makeProfilesEditor(typeColumn: string, side: "Vendor" | "Customer"): Editor {
  return function ProfilesEditor(p) {
    const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
    const options = optionsOf(p);
    const [picked, setPicked] = useState(() => currentList(p));
    const value = () => joinList(options.filter((o) => hasIn(picked, o)).concat(picked.filter((v) => !hasIn(options, v))));
    const typeValues = splitList(p.row[typeColumn] ?? "");
    const typeLabel = p.def.columns.find((c) => c.key === typeColumn)?.label ?? "Partner Type";
    const conditionUnmet = typeValues.length > 0 && !hasIn(typeValues, side);
    return (
      <CellPopover
      fin={fin}
        width={300}
        trigger={picked.length ? picked.join(" · ") : null}
        onDismiss={() => commit(value())}
        onEscape={cancel}
        onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
      >
        <div className="px-3.5 pt-3 pb-2 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[11px] text-[#64748B] uppercase tracking-wider" style={{ fontWeight: 600 }}>Profiles</p>
          <p className="text-[11px] text-[#94A3B8]">{picked.length} active</p>
        </div>
        <UnknownPicks picked={picked} known={options} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
        <div className="p-1.5 overflow-y-auto">
          {options.map((opt) => {
            const meta = PROFILE_META[opt] ?? { Icon: Settings2 };
            const on = hasIn(picked, opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setPicked((prev) => toggleIn(prev, opt))}
                className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer"
                style={{ backgroundColor: on ? "#EDF4FF" : "transparent", boxShadow: on ? "inset 0 0 0 1px rgba(10,119,255,0.2)" : undefined }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: on ? "#0A77FF" : "#F1F5F9", color: on ? "#FFFFFF" : "#94A3B8" }}
                >
                  <meta.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0 text-[12.5px]" style={{ fontWeight: on ? 600 : 500, color: on ? "#0A77FF" : "#334155" }}>{opt}</span>
                {meta.comingSoon ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#94A3B8] uppercase tracking-wider whitespace-nowrap" style={{ fontWeight: 600 }}>Coming soon</span>
                ) : on ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0A77FF]/10 text-[#0A77FF]" style={{ fontWeight: 600 }}>ON</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {conditionUnmet && <ListFooterNote>Only applied when {typeLabel} includes {side}. This row has {typeValues.join(", ")}.</ListFooterNote>}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
          <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
        </div>
      </CellPopover>
    );
  };
}

/* ════════════════════════════════════════════════════════════
   Partner Groups / Primary Partner Group — Step 1 group cards
   ════════════════════════════════════════════════════════════ */
const GROUP_BY_NAME = new Map<string, PickerGroup>(PICKER_GROUPS.map((g) => [g.name.toLowerCase(), g]));

function GroupCard({
  name,
  query,
  selected,
  primary,
  onClick,
}: {
  name: string;
  query: string;
  selected: boolean;
  primary: boolean;
  onClick: () => void;
}) {
  const g = GROUP_BY_NAME.get(name.toLowerCase());
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left p-3 rounded-lg border transition-all duration-150 cursor-pointer"
      style={{
        borderColor: selected ? "#0A77FF" : "#E2E8F0",
        backgroundColor: selected ? "#F5F9FF" : "#FFFFFF",
        boxShadow: selected ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)" : "none",
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = "#CBD5E1";
        e.currentTarget.style.backgroundColor = "#FAFCFF";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.backgroundColor = "#FFFFFF";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {primary && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>
            <Star className="w-2.5 h-2.5 fill-white" />
            Primary
          </span>
        )}
        {selected ? (
          <span className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="flex items-start gap-2 mb-1.5 pr-16">
        <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: selected ? "#D6E8FF" : "#F1F5F9" }}>
          <Building2 className="w-4 h-4" style={{ color: selected ? "#0A77FF" : "#64748B" }} />
        </span>
        {g?.countryFlag && <span className="text-[14px] leading-none mt-1.5 shrink-0" title={g.country}>{g.countryFlag}</span>}
      </div>
      <p className="text-[13px] text-[#0F172A] break-words pr-2" style={{ fontWeight: selected ? 600 : 500 }}>{highlight(name, query)}</p>
      <p className="text-[11px] text-[#94A3B8] line-clamp-2 pr-2 mt-0.5 break-words">
        {g ? highlight(g.description, query) : "Partner group in Omne."}
      </p>
      {g && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>
          <Users className="w-3 h-3" /> {g.memberCount} partners
        </p>
      )}
    </button>
  );
}

function groupFilter(names: string[], query: string): string[] {
  return names.filter((n) => {
    const g = GROUP_BY_NAME.get(n.toLowerCase());
    return matches(query, n, g?.description, g?.country);
  });
}

export const PartnerGroupsEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const all = useMemo(() => p.def.referenceOptions("groups"), [p.def]);
  const [picked, setPicked] = useState(() => currentList(p, all));
  const [query, setQuery] = useState("");
  const primary = (p.row.primaryPartnerGroup ?? "").trim();
  const shown = groupFilter(all, query);
  const value = () => joinList(picked);
  return (
    <CellOverlay
      fin={fin}
      trigger={picked.length ? picked.join(" · ") : null}
      title="Select Partner Groups"
      subtitle="Choose one or more partner groups. The primary group is set in Primary Partner Group."
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
      footer={<MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />}
    >
      <div className="px-5 pt-3 pb-2 bg-[#FAFBFC] border-b border-[#EEF2F6]">
        <SearchBox value={query} onChange={setQuery} placeholder="Search partner groups..." />
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {picked.map((name) => {
              const unknown = !hasIn(all, name);
              const isPrimary = !unknown && sameText(name, primary);
              return (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[12px] border"
                  title={unknown ? "Not in Omne" : undefined}
                  style={{
                    fontWeight: 500,
                    backgroundColor: unknown ? "#FFFBEB" : isPrimary ? "#EDF4FF" : "#F8FAFC",
                    color: unknown ? "#92400E" : isPrimary ? "#0A77FF" : "#334155",
                    borderColor: unknown ? "#FDE68A" : isPrimary ? "rgba(10,119,255,0.3)" : "#E2E8F0",
                  }}
                >
                  {isPrimary && <Star className="w-3 h-3 fill-[#0A77FF] text-[#0A77FF]" />}
                  {unknown && <AlertTriangle className="w-3 h-3" />}
                  {name}
                  <button
                    type="button"
                    onClick={() => setPicked((prev) => toggleIn(prev, name))}
                    className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5 cursor-pointer"
                    aria-label={`Remove ${name}`}
                  >
                    <span className="text-[11px] leading-none">×</span>
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <p className="text-xs text-[#94A3B8] mt-2">
          {query.trim() ? `${shown.length} result${shown.length !== 1 ? "s" : ""} for "${query}"` : `${all.length} groups available`}
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {shown.map((name) => (
            <GroupCard
              key={name}
              name={name}
              query={query}
              selected={hasIn(picked, name)}
              primary={sameText(name, primary)}
              onClick={() => setPicked((prev) => toggleIn(prev, name))}
            />
          ))}
        </div>
        {shown.length === 0 && <p className="py-10 text-center text-[13px] text-[#64748B]">No groups found. Try adjusting your search terms.</p>}
      </div>
    </CellOverlay>
  );
};

export const PrimaryGroupEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const all = useMemo(() => p.def.referenceOptions("groups"), [p.def]);
  const current = canonicalOption(p.initialValue, all) ?? p.initialValue.trim();
  const [query, setQuery] = useState("");
  const onRow = splitList(p.row.partnerGroups ?? "").map((v) => canonicalOption(v, all) ?? v);
  const rowShown = groupFilter(onRow, query);
  const otherShown = groupFilter(all.filter((n) => !hasIn(onRow, n)), query);
  return (
    <CellOverlay
      fin={fin}
      trigger={current || null}
      title="Primary Partner Group"
      subtitle="The one group whose configuration this partner inherits. It must be one of the Partner Groups on this row."
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, () => current, commit)}
      footer={
        <>
          <span style={{ fontSize: "12px", color: "#64748B" }}>{current ? `Primary: ${current}` : "No primary group set"}</span>
          <button type="button" onClick={cancel} className="h-7 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] cursor-pointer" style={{ fontSize: "12.5px", fontWeight: 500 }}>
            Cancel
          </button>
        </>
      }
    >
      <div className="px-5 pt-3 pb-2 bg-[#FAFBFC] border-b border-[#EEF2F6]">
        <SearchBox value={query} onChange={setQuery} placeholder="Search partner groups..." />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        {rowShown.length > 0 && (
          <>
            <SectionLabel>Partner Groups on this row</SectionLabel>
            <div className="grid gap-2.5 mb-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {rowShown.map((name) => (
                <GroupCard key={name} name={name} query={query} selected={sameText(name, current)} primary={sameText(name, current)} onClick={() => commit(name)} />
              ))}
            </div>
          </>
        )}
        {onRow.length === 0 && <ListFooterNote>This row lists no Partner Groups yet. The primary group must also be added to Partner Groups.</ListFooterNote>}
        <SectionLabel>All partner groups</SectionLabel>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {otherShown.map((name) => (
            <GroupCard key={name} name={name} query={query} selected={sameText(name, current)} primary={sameText(name, current)} onClick={() => commit(name)} />
          ))}
        </div>
      </div>
    </CellOverlay>
  );
};

/* ════════════════════════════════════════════════════════════
   Points of Contact — contact directory picker
   ════════════════════════════════════════════════════════════ */
const CONTACT_BY_NAME = new Map(PICKER_CONTACTS.map((c) => [c.name.toLowerCase(), c]));
const SHOW_LIMIT = 80;

function Avatar({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10.5px]"
      style={{ backgroundColor: color ?? "#94A3B8", fontWeight: 600 }}
    >
      {initials(name)}
    </span>
  );
}

export const ContactsEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const all = useMemo(() => Array.from(new Set(p.def.referenceOptions("contacts"))), [p.def]);
  const [picked, setPicked] = useState(() => currentList(p, all));
  const [query, setQuery] = useState("");
  const shown = all.filter((n) => {
    const c = CONTACT_BY_NAME.get(n.toLowerCase());
    return matches(query, n, c?.company, c?.department, c?.email);
  });
  const ordered = [...shown.filter((n) => hasIn(picked, n)), ...shown.filter((n) => !hasIn(picked, n))];
  const value = () => joinList(picked);
  return (
    <CellPopover
      fin={fin}
      width={340}
      trigger={picked.length ? picked.join(" · ") : null}
      placeholder="- Select contacts -"
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
    >
      <div className="p-2 border-b border-[#F1F5F9]">
        <SearchBox value={query} onChange={setQuery} placeholder="Search contacts by name, company or email" />
      </div>
      <UnknownPicks picked={picked} known={all} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
      <div className="overflow-y-auto py-1.5 px-1.5" style={{ maxHeight: 300 }}>
        {ordered.slice(0, SHOW_LIMIT).map((name) => {
          const c = CONTACT_BY_NAME.get(name.toLowerCase());
          const on = hasIn(picked, name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => setPicked((prev) => toggleIn(prev, name))}
              className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            >
              <CheckMark on={on} />
              <Avatar name={name} color={c?.avatarColor} />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>{highlight(name, query)}</span>
                <span className="block truncate text-[11px] text-[#64748B]">
                  {c ? `${c.department} · ${c.company}` : "Contact Directory"}
                </span>
              </span>
            </button>
          );
        })}
        {ordered.length > SHOW_LIMIT && (
          <p className="px-2 py-2 text-[11.5px] text-[#94A3B8]">Showing {SHOW_LIMIT} of {ordered.length}. Search to narrow the list.</p>
        )}
        {ordered.length === 0 && <p className="px-3 py-6 text-center text-[12.5px] text-[#94A3B8]">No contacts match "{query}"</p>}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
        <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
      </div>
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Linked Partners / Primary Partners — partner picker
   ════════════════════════════════════════════════════════════ */
const PARTNER_TINTS = ["#0A77FF", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#0891B2", "#64748B"];
function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PARTNER_TINTS[h % PARTNER_TINTS.length];
}

/** `subsetOf` names the row column this picker is restricted to (Primary Partners -> Linked Partners). */
export function makePartnersEditor(subsetOf?: string): Editor {
  return function PartnersEditor(p) {
    const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
    const all = useMemo(() => {
      const seen = new Set<string>();
      return p.def.referenceOptions("partners").filter((n) => {
        const k = n.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }, [p.def]);
    const [picked, setPicked] = useState(() => currentList(p, all));
    const [query, setQuery] = useState("");
    const sibling = subsetOf ? splitList(p.row[subsetOf] ?? "") : [];
    const siblingLabel = subsetOf ? p.def.columns.find((c) => c.key === subsetOf)?.label ?? subsetOf : "";
    const visible = all.filter((n) => matches(query, n));
    const onRow = subsetOf ? visible.filter((n) => hasIn(sibling, n)) : [];
    const rest = visible.filter((n) => !hasIn(onRow, n));
    const restOrdered = [...rest.filter((n) => hasIn(picked, n)), ...rest.filter((n) => !hasIn(picked, n))];
    const value = () => joinList(picked);
    const row = (name: string) => {
      const on = hasIn(picked, name);
      return (
        <button
          key={name}
          type="button"
          onClick={() => setPicked((prev) => toggleIn(prev, name))}
          className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[#F8FAFC]"
        >
          <CheckMark on={on} />
          <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10.5px]" style={{ backgroundColor: `${tintFor(name)}1A`, color: tintFor(name), fontWeight: 700 }}>
            {initials(name)}
          </span>
          <span className="flex-1 min-w-0 truncate text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>{highlight(name, query)}</span>
        </button>
      );
    };
    return (
      <CellPopover
      fin={fin}
        width={340}
        trigger={picked.length ? picked.join(" · ") : null}
        placeholder="- Select partners -"
        onDismiss={() => commit(value())}
        onEscape={cancel}
        onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
      >
        <div className="p-2 border-b border-[#F1F5F9]">
          <SearchBox value={query} onChange={setQuery} placeholder="Search partners" />
        </div>
        <UnknownPicks picked={picked} known={all} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
        <div className="overflow-y-auto py-1 px-1.5" style={{ maxHeight: 300 }}>
          {subsetOf && (
            <>
              <SectionLabel>{siblingLabel} on this row</SectionLabel>
              {onRow.map(row)}
              {sibling.length === 0 && <ListFooterNote>This row lists no {siblingLabel} yet. Primary partners must also be linked.</ListFooterNote>}
              <SectionLabel>Other partners</SectionLabel>
            </>
          )}
          {restOrdered.slice(0, SHOW_LIMIT).map(row)}
          {restOrdered.length > SHOW_LIMIT && (
            <p className="px-2 py-2 text-[11.5px] text-[#94A3B8]">Showing {SHOW_LIMIT} of {restOrdered.length}. Search to narrow the list.</p>
          )}
          {visible.length === 0 && <p className="px-3 py-6 text-center text-[12.5px] text-[#94A3B8]">No partners match "{query}"</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
          <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
        </div>
      </CellPopover>
    );
  };
}

/* ════════════════════════════════════════════════════════════
   Single-pick searchable lists: country, dial code, currency
   ════════════════════════════════════════════════════════════ */
interface ListOption {
  value: string;
  key: string;
  lead?: React.ReactNode;
  label: string;
  meta?: string;
  search: string;
}

function SearchSingle({
  p,
  items,
  width,
  searchPlaceholder,
  current,
}: {
  p: SpecialCellEditorProps;
  items: ListOption[];
  width: number;
  searchPlaceholder: string;
  current: ListOption | undefined;
}) {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const [query, setQuery] = useState("");
  const shown = items.filter((i) => matches(query, i.search));
  const list = useListHighlight(shown.length, Math.max(0, shown.findIndex((i) => i.key === current?.key)));
  return (
    <CellPopover
      fin={fin}
      width={width}
      trigger={current ? (
        <>
          {current.lead}
          <span className="truncate">{current.label}</span>
        </>
      ) : (p.initialValue || null)}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => {
        list.onKeyDown(e, (i) => shown[i] && commit(shown[i].value));
        panelKeys(e, () => shown[list.index]?.value ?? p.initialValue, commit);
      }}
    >
      <div className="p-3 shrink-0">
        <SearchBox value={query} onChange={setQuery} placeholder={searchPlaceholder} />
      </div>
      <div className="border-t border-[#F1F5F9] overflow-y-auto" style={{ maxHeight: 280 }}>
        {shown.length === 0 && <div className="py-6 text-center text-xs text-[#94A3B8]">No results found</div>}
        {shown.map((item, i) => {
          const selected = item.key === current?.key;
          return (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => list.setIndex(i)}
              onClick={() => commit(item.value)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer"
              style={{ backgroundColor: list.index === i ? "#F8FAFC" : selected ? "#EDF4FF80" : "transparent" }}
            >
              {item.lead}
              <span className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{highlight(item.label, query)}</span>
              {item.meta && <span className="ml-auto text-[12px] text-[#64748B] shrink-0 tabular-nums" style={{ fontWeight: 600 }}>{item.meta}</span>}
              {selected && <Check className={`w-4 h-4 text-[#0A77FF] shrink-0 ${item.meta ? "" : "ml-auto"}`} />}
            </button>
          );
        })}
      </div>
    </CellPopover>
  );
}

const COUNTRY_ISO: Record<string, string> = {
  "United States": "US", Canada: "CA", Mexico: "MX", "United Kingdom": "GB", Germany: "DE", France: "FR", Italy: "IT",
  Spain: "ES", Netherlands: "NL", Switzerland: "CH", Sweden: "SE", Norway: "NO", Denmark: "DK", Ireland: "IE", Poland: "PL",
  Australia: "AU", "New Zealand": "NZ", Japan: "JP", "South Korea": "KR", China: "CN", Taiwan: "TW", "Hong Kong": "HK",
  Singapore: "SG", Malaysia: "MY", Indonesia: "ID", Philippines: "PH", Thailand: "TH", Vietnam: "VN", India: "IN",
  Pakistan: "PK", Bangladesh: "BD", "United Arab Emirates": "AE", "Saudi Arabia": "SA", Israel: "IL", Turkey: "TR",
  "South Africa": "ZA", Egypt: "EG", Nigeria: "NG", Kenya: "KE", Brazil: "BR", Argentina: "AR", Chile: "CL", Colombia: "CO", Peru: "PE",
};
function flagOf(iso?: string): string {
  if (!iso) return "";
  return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
const FlagLead = ({ flag }: { flag: string }) => <span className="text-base shrink-0 leading-none">{flag}</span>;

export const CountryEditor: Editor = (p) => {
  const items: ListOption[] = optionsOf(p).map((name) => ({
    value: name, key: name, label: name, search: name, lead: <FlagLead flag={flagOf(COUNTRY_ISO[name])} />,
  }));
  const current = items.find((i) => sameText(i.value, p.initialValue));
  return <SearchSingle p={p} items={items} width={300} searchPlaceholder="Search country..." current={current} />;
};

/* The Create Partner phone field's country-code list (CreatePartnerModal COUNTRY_CODES). */
const DIAL_CODES: { code: string; flag: string; country: string }[] = [
  { code: "+1", flag: "🇺🇸", country: "United States" }, { code: "+1", flag: "🇨🇦", country: "Canada" },
  { code: "+44", flag: "🇬🇧", country: "United Kingdom" }, { code: "+49", flag: "🇩🇪", country: "Germany" },
  { code: "+33", flag: "🇫🇷", country: "France" }, { code: "+81", flag: "🇯🇵", country: "Japan" },
  { code: "+86", flag: "🇨🇳", country: "China" }, { code: "+91", flag: "🇮🇳", country: "India" },
  { code: "+61", flag: "🇦🇺", country: "Australia" }, { code: "+55", flag: "🇧🇷", country: "Brazil" },
  { code: "+971", flag: "🇦🇪", country: "UAE" }, { code: "+65", flag: "🇸🇬", country: "Singapore" },
  { code: "+82", flag: "🇰🇷", country: "South Korea" }, { code: "+52", flag: "🇲🇽", country: "Mexico" },
  { code: "+31", flag: "🇳🇱", country: "Netherlands" }, { code: "+46", flag: "🇸🇪", country: "Sweden" },
  { code: "+41", flag: "🇨🇭", country: "Switzerland" }, { code: "+34", flag: "🇪🇸", country: "Spain" },
  { code: "+39", flag: "🇮🇹", country: "Italy" }, { code: "+48", flag: "🇵🇱", country: "Poland" },
];

export const PhoneCodeEditor: Editor = (p) => {
  const allowed = optionsOf(p);
  const items: ListOption[] = DIAL_CODES.filter((d) => allowed.includes(d.code)).map((d) => ({
    value: d.code, key: `${d.code}-${d.country}`, label: d.country, meta: d.code, search: `${d.country} ${d.code}`, lead: <FlagLead flag={d.flag} />,
  }));
  const current = items.find((i) => i.value === p.initialValue.trim());
  return <SearchSingle p={p} items={items} width={300} searchPlaceholder="Search country or code..." current={current} />;
};

export const CurrencyEditor: Editor = (p) => {
  const allowed = optionsOf(p);
  const byCode = new Map(PICKER_CURRENCIES.map((c) => [c.code, c]));
  const items: ListOption[] = allowed.map((code) => {
    const c = byCode.get(code);
    return {
      value: code,
      key: code,
      label: c?.label ?? code,
      search: c ? `${c.label} ${c.symbol}` : code,
      lead: (
        <>
          <FlagLead flag={c?.flag ?? ""} />
          <span className="w-7 text-center text-[12px] text-[#64748B] shrink-0" style={{ fontWeight: 600 }}>{c?.symbol}</span>
        </>
      ),
    };
  });
  const current = items.find((i) => sameText(i.value, p.initialValue));
  return <SearchSingle p={p} items={items} width={300} searchPlaceholder="Search currency..." current={current} />;
};

/* ════════════════════════════════════════════════════════════
   Credit Enforcement — the three enforcement cards
   ════════════════════════════════════════════════════════════ */
const ENFORCEMENT = [
  {
    value: "None", title: "No Enforcement", Icon: Info, color: "#0A77FF", tile: "#EDF4FF", recommended: true,
    text: "No action when exceeded. A passive \"Over Limit\" label appears on the order as an indicator only.",
  },
  {
    value: "Soft Warning", title: "Soft Warning", Icon: AlertTriangle, color: "#EAB308", tile: "#FEFCE8", iconColor: "#CA8A04",
    text: "A confirmation prompt is shown before the order can proceed. The user must acknowledge to continue.",
  },
  {
    value: "Hard Block", title: "Hard Block", Icon: Lock, color: "#EF4444", tile: "#FEF2F2",
    text: "Orders cannot be placed when the limit is exceeded. Blocked until the balance is resolved.",
  },
] as const;

export const CreditEnforcementEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const cards = ENFORCEMENT.filter((c) => options.includes(c.value));
  const current = canonicalOption(p.initialValue, options);
  const list = useListHighlight(cards.length, Math.max(0, cards.findIndex((c) => c.value === current)));
  return (
    <CellPopover
      fin={fin}
      width={340}
      trigger={current ? ENFORCEMENT.find((c) => c.value === current)?.title : p.initialValue || null}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => {
        list.onKeyDown(e, (i) => commit(cards[i].value));
        panelKeys(e, () => cards[list.index]?.value ?? p.initialValue, commit);
      }}
      className="p-2 gap-2"
    >
      {cards.map((c, i) => {
        const on = c.value === current;
        const hot = list.index === i;
        return (
          <button
            key={c.value}
            type="button"
            onMouseEnter={() => list.setIndex(i)}
            onClick={() => commit(c.value)}
            className="text-left rounded-xl border bg-white p-3.5 transition-all cursor-pointer"
            style={{
              borderColor: on ? `${c.color}4D` : hot ? `${c.color}33` : "#E2E8F0",
              boxShadow: hot && !on ? "0 4px 12px -4px rgba(15,23,42,0.12)" : "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: on ? c.tile : "#F1F5F9" }}>
                <c.Icon className="w-4 h-4" style={{ color: on ? ("iconColor" in c ? c.iconColor : c.color) : "#94A3B8" }} />
              </span>
              <span className="flex items-center gap-1.5">
                {"recommended" in c && c.recommended && (
                  <span className="text-[8px] px-1.5 py-[1px] rounded-full bg-[#EDF4FF] text-[#0A77FF] border border-[#0A77FF]/15" style={{ fontWeight: 600 }}>Recommended</span>
                )}
                <Radio on={on} color={c.color} />
              </span>
            </div>
            <p className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>{c.title}</p>
            <p className="text-[10.5px] text-[#64748B] mt-0.5 leading-relaxed">{c.text}</p>
          </button>
        );
      })}
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Payment Term — the payment terms picker (sidebar + preset cards)
   ════════════════════════════════════════════════════════════ */
const TERM_BADGE: Record<string, { bg: string; text: string }> = {
  net: { bg: "#EDF4FF", text: "#0A77FF" },
  prepayment: { bg: "#F5F3FF", text: "#7C3AED" },
  split: { bg: "#FFFBEB", text: "#B45309" },
};
const TERM_TABS = [
  { id: "all", label: "All Terms" },
  { id: "net", label: "NET Terms" },
  { id: "prepayment", label: "Prepayment Terms" },
  { id: "split", label: "Split Terms" },
];

function SidebarTabs({ tabs, active, onPick, counts }: { tabs: { id: string; label: string }[]; active: string; onPick: (id: string) => void; counts: Record<string, number> }) {
  return (
    <div className="w-[150px] shrink-0 border-r border-[#EEF2F6] bg-[#FAFBFC] py-2 px-1.5">
      <SectionLabel>Predefined Templates</SectionLabel>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors"
            style={{ backgroundColor: on ? "#EDF4FF" : "transparent", color: on ? "#0A77FF" : "#475569", fontWeight: on ? 600 : 500 }}
          >
            {t.label}
            <span className="text-[10.5px] tabular-nums" style={{ color: on ? "#0A77FF" : "#94A3B8" }}>{counts[t.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export const PaymentTermEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const terms = PICKER_PAYMENT_TERMS.filter((t) => hasIn(options, t.name));
  const current = canonicalOption(p.initialValue, options);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const counts = Object.fromEntries(TERM_TABS.map((t) => [t.id, t.id === "all" ? terms.length : terms.filter((x) => x.category === t.id).length]));
  const shown = terms.filter((t) => (tab === "all" || t.category === tab) && matches(query, t.name, t.description, t.trigger));
  const list = useListHighlight(shown.length, Math.max(0, shown.findIndex((t) => t.name === current)));
  return (
    <CellPopover
      fin={fin}
      width={640}
      trigger={current ?? (p.initialValue || null)}
      onDismiss={cancel}
      onEscape={cancel}
      onKeyDown={(e) => {
        list.onKeyDown(e, (i) => shown[i] && commit(shown[i].name));
        panelKeys(e, () => shown[list.index]?.name ?? p.initialValue, commit);
      }}
    >
      <div className="flex min-h-0 flex-1" style={{ height: 420 }}>
        <SidebarTabs tabs={TERM_TABS} active={tab} onPick={setTab} counts={counts} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-2.5 border-b border-[#F1F5F9]">
            <SearchBox value={query} onChange={setQuery} placeholder="Search payment terms..." />
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {shown.length === 0 && <p className="py-8 text-center text-xs text-[#94A3B8]">No payment terms match.</p>}
            {shown.map((t, i) => {
              const on = t.name === current;
              const badge = TERM_BADGE[t.category] ?? TERM_BADGE.net;
              return (
                <button
                  key={t.name}
                  type="button"
                  onMouseEnter={() => list.setIndex(i)}
                  onClick={() => commit(t.name)}
                  className="text-left rounded-lg border px-3 py-2.5 cursor-pointer transition-all"
                  style={{
                    borderColor: on ? "#0A77FF" : list.index === i ? "#CBD5E1" : "#E2E8F0",
                    backgroundColor: on ? "#F5F9FF" : "#FFFFFF",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-px rounded text-[10px] uppercase" style={{ fontWeight: 700, backgroundColor: badge.bg, color: badge.text }}>{t.typeBadge}</span>
                    <span className="flex-1 min-w-0 truncate text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{highlight(t.name, query)}</span>
                    {on && <Check className="w-4 h-4 text-[#0A77FF] shrink-0" />}
                  </div>
                  <p className="text-[11.5px] text-[#64748B] mt-1">{t.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[10.5px] text-[#475569]" style={{ fontWeight: 500 }}>
                      <Receipt className="w-2.5 h-2.5" /> Trigger: {t.trigger}
                    </span>
                    <span className="text-[10.5px] text-[#94A3B8]">Applied to {t.vendorsApplied} partners</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Pricing Rules — the pricing rules picker (multi)
   ════════════════════════════════════════════════════════════ */
const RULE_TABS = [
  { id: "all", label: "All Rules" },
  { id: "discount", label: "Discounts" },
  { id: "premium", label: "Premiums" },
];
const RULE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  discount: { bg: "#ECFDF5", text: "#047857", label: "Discount" },
  premium: { bg: "#FFF7ED", text: "#C2410C", label: "Premium" },
};

export const PricingRulesEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const rules = PICKER_PRICING_RULES.filter((r) => hasIn(options, r.name));
  const [picked, setPicked] = useState(() => currentList(p));
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const counts = Object.fromEntries(RULE_TABS.map((t) => [t.id, t.id === "all" ? rules.length : rules.filter((x) => x.category === t.id).length]));
  const shown = rules.filter((r) => (tab === "all" || r.category === tab) && matches(query, r.name, r.description));
  const value = () => joinList(picked);
  return (
    <CellPopover
      fin={fin}
      width={640}
      trigger={picked.length ? picked.join(" · ") : null}
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
    >
      <div className="flex min-h-0 flex-1" style={{ height: 400 }}>
        <SidebarTabs tabs={RULE_TABS} active={tab} onPick={setTab} counts={counts} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-2.5 border-b border-[#F1F5F9]">
            <SearchBox value={query} onChange={setQuery} placeholder="Search pricing rules..." />
          </div>
          <UnknownPicks picked={picked} known={rules.map((r) => r.name)} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {shown.length === 0 && <p className="py-8 text-center text-xs text-[#94A3B8]">No pricing rules match.</p>}
            {shown.map((r) => {
              const on = hasIn(picked, r.name);
              const badge = RULE_BADGE[r.category] ?? RULE_BADGE.discount;
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setPicked((prev) => toggleIn(prev, r.name))}
                  className="text-left rounded-lg border px-3 py-2.5 cursor-pointer transition-all flex items-start gap-2.5"
                  style={{ borderColor: on ? "#0A77FF" : "#E2E8F0", backgroundColor: on ? "#F5F9FF" : "#FFFFFF" }}
                >
                  <span className="mt-0.5"><CheckMark on={on} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px]" style={{ fontWeight: 700, backgroundColor: badge.bg, color: badge.text }}>
                        <Tag className="w-2.5 h-2.5" /> {badge.label}
                      </span>
                      <span className="truncate text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{highlight(r.name, query)}</span>
                    </span>
                    <span className="block text-[11.5px] text-[#64748B] mt-1">{r.description}</span>
                    <span className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-1.5 py-px rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[10.5px] text-[#475569] capitalize" style={{ fontWeight: 500 }}>{r.basis}</span>
                      <span className="px-1.5 py-px rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[10.5px] text-[#475569]" style={{ fontWeight: 500 }}>
                        {r.tierType === "single" ? "Single-Tier" : `${r.totalTiers} tiers`}
                      </span>
                      {r.validityPeriod && <span className="text-[10.5px] text-[#94A3B8]">{r.validityPeriod}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
            <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
          </div>
        </div>
      </div>
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Payment Methods — the payment type cards (multi)
   ════════════════════════════════════════════════════════════ */
const PAYMENT_ICON: Record<string, ComponentType<{ className?: string }>> = {
  ach: CircleDollarSign, wire: Landmark, card: CreditCard, digital_wallet: Wallet, check: Receipt, cash: Banknote, other: FileText,
};
const METHOD_LABEL_BY_ID = new Map(PAYMENT_METHODS.map((m) => [m.id, m.label]));

export const PaymentMethodsEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const [picked, setPicked] = useState(() => currentList(p));
  const cards = PICKER_PAYMENT_TYPES.map((t) => ({ ...t, value: METHOD_LABEL_BY_ID.get(t.id) ?? t.label })).filter((t) => hasIn(options, t.value));
  const categories = Array.from(new Set(cards.map((c) => c.category)));
  const value = () => joinList([...options.filter((o) => hasIn(picked, o)), ...picked.filter((v) => !hasIn(options, v))]);
  return (
    <CellPopover
      fin={fin}
      width={400}
      trigger={picked.length ? picked.join(" · ") : null}
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
    >
      <UnknownPicks picked={picked} known={cards.map((c) => c.value)} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
      <div className="overflow-y-auto p-1.5">
        {categories.map((cat) => (
          <div key={cat} className="pb-1">
            <SectionLabel>{cat}</SectionLabel>
            {cards.filter((c) => c.category === cat).map((c) => {
              const Icon = PAYMENT_ICON[c.id] ?? FileText;
              const on = hasIn(picked, c.value);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked((prev) => toggleIn(prev, c.value))}
                  className="flex items-start gap-2.5 w-full text-left px-2.5 py-2 rounded-lg border cursor-pointer transition-colors mb-1"
                  style={{ borderColor: on ? "rgba(10,119,255,0.35)" : "transparent", backgroundColor: on ? "#F5F9FF" : "transparent" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: on ? "#D6E8FF" : "#F1F5F9", color: on ? "#0A77FF" : "#64748B" }}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{c.label}</span>
                    <span className="block text-[11px] text-[#64748B] mt-0.5 leading-snug">{c.description}</span>
                  </span>
                  <span className="mt-1"><CheckMark on={on} /></span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
        <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
      </div>
    </CellPopover>
  );
};

/* ════════════════════════════════════════════════════════════
   Carriers — preferred shipping carriers, first one is the default
   ════════════════════════════════════════════════════════════ */
export const CarriersEditor: Editor = (p) => {
  const { commit, cancel, ...fin } = useFinalize(p.onCommit, p.onCancel);
  const options = optionsOf(p);
  const carriers = CARRIERS.filter((c) => hasIn(options, c.label));
  const [picked, setPicked] = useState(() => currentList(p));
  const value = () => joinList(picked);
  return (
    <CellPopover
      fin={fin}
      width={340}
      trigger={picked.length ? picked.join(" · ") : null}
      onDismiss={() => commit(value())}
      onEscape={cancel}
      onKeyDown={(e) => panelKeys(e, value, commit, { enterCommits: true })}
    >
      <div className="px-3.5 pt-3 pb-2 border-b border-[#F1F5F9]">
        <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Preferred carriers</p>
        <p className="text-[11px] text-[#94A3B8] mt-px">Pick in order of preference. The first one becomes the default.</p>
      </div>
      <UnknownPicks picked={picked} known={carriers.map((c) => c.label)} onRemove={(v) => setPicked((prev) => toggleIn(prev, v))} />
      <div className="overflow-y-auto p-1.5" style={{ maxHeight: 320 }}>
        {carriers.map((c) => {
          const pos = picked.findIndex((v) => sameText(v, c.label));
          const on = pos >= 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPicked((prev) => toggleIn(prev, c.label))}
              className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            >
              <CheckMark on={on} />
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: on ? "#D6E8FF" : "#F1F5F9", color: on ? "#0A77FF" : "#64748B" }}>
                <Truck className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{c.label}</span>
                <span className="block truncate text-[11px] text-[#64748B]">{c.name}</span>
              </span>
              {on && (
                pos === 0 ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>Default</span>
                ) : (
                  <span className="text-[11px] text-[#94A3B8] tabular-nums" style={{ fontWeight: 600 }}>#{pos + 1}</span>
                )
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
        <MultiFooter count={picked.length} onClear={() => setPicked([])} onDone={() => commit(value())} />
      </div>
    </CellPopover>
  );
};
