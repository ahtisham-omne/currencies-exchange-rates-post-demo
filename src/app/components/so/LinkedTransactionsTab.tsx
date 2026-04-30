import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronRight, FileText, ShoppingCart, FileCheck,
  ClipboardList, Truck, PackageCheck, Copy,
} from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ThTooltip, Tooltip } from "./Tooltip";
import type { LinkedTransaction } from "./types";

const TYPE_META: Record<string, { icon: typeof FileText; plural: string }> = {
  Quote: { icon: ShoppingCart, plural: "Quotes" }, Contract: { icon: FileCheck, plural: "Contracts" },
  "Pick Ticket": { icon: ClipboardList, plural: "Pick Tickets" }, Shipment: { icon: Truck, plural: "Shipments" },
  "Delivery Confirmation": { icon: PackageCheck, plural: "Delivery Confirmations" }, Return: { icon: FileText, plural: "Returns" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Converted: { bg: "bg-accent/10", text: "text-accent" }, Active: { bg: "bg-accent/10", text: "text-accent" },
  Completed: { bg: "bg-accent/10", text: "text-accent" }, Shipped: { bg: "bg-primary/10", text: "text-primary" },
  Delivered: { bg: "bg-accent/10", text: "text-accent" }, Invoiced: { bg: "bg-chart-4/10", text: "text-chart-4" },
  Paid: { bg: "bg-accent/10", text: "text-accent" }, "Partially Paid": { bg: "bg-chart-3/10", text: "text-chart-3" },
  Issued: { bg: "bg-primary/10", text: "text-primary" }, "In Progress": { bg: "bg-primary/10", text: "text-primary" },
  Draft: { bg: "bg-secondary", text: "text-foreground/70" }, Pending: { bg: "bg-chart-3/10", text: "text-chart-3" },
  Cancelled: { bg: "bg-destructive/10", text: "text-destructive" },
};

const AVATAR_COLORS = [
  { bg: "bg-accent/10", text: "text-accent" }, { bg: "bg-chart-3/10", text: "text-chart-3" },
  { bg: "bg-primary/10", text: "text-primary" }, { bg: "bg-chart-4/10", text: "text-chart-4" },
  { bg: "bg-chart-3/15", text: "text-chart-3" }, { bg: "bg-destructive/10", text: "text-destructive" },
];
function avatarColor(initials: string) {
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = initials.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const SECTIONS = [
  { key: "source", label: "Source Documents", types: ["Quote", "Contract"] },
  { key: "fulfillment", label: "Fulfillment Transactions", types: ["Pick Ticket", "Shipment", "Delivery Confirmation"] },
  { key: "returns", label: "Returns", types: ["Return"] },
];
const ALL_TYPES = ["Quote", "Contract", "Pick Ticket", "Shipment", "Delivery Confirmation", "Return"];
type FilterKey = "all" | string;

interface Props { transactions: LinkedTransaction[]; }

export function LinkedTransactionsTab({ transactions }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  /* Filter out Invoice / Payment Receipt / Credit Memo — those live in Invoicing tab now */
  const EXCLUDED_TYPES = ["Invoice", "Credit Memo", "Payment Receipt"];
  const txns = useMemo(() => transactions.filter(t => !EXCLUDED_TYPES.includes(t.type)), [transactions]);

  const totalAmount = useMemo(() => txns.reduce((s, t) => s + t.amount, 0), [txns]);
  const typeCounts = useMemo(() => { const m: Record<string, number> = {}; txns.forEach(t => { m[t.type] = (m[t.type] || 0) + 1; }); return m; }, [txns]);

  const filtered = useMemo(() => {
    let list = txns;
    if (filter !== "all") list = list.filter(t => t.type === filter);
    if (search) { const q = search.toLowerCase(); list = list.filter(t => t.number.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.createdBy.toLowerCase().includes(q)); }
    return list;
  }, [txns, filter, search]);

  const pills: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: txns.length },
    ...ALL_TYPES.filter(t => (typeCounts[t] || 0) > 0).map(t => ({ key: t, label: TYPE_META[t]?.plural ?? t, count: typeCounts[t] || 0 })),
  ];

  if (txns.length === 0) {
    return <div className="bg-card border border-border p-8 text-center text-foreground/50 text-[length:var(--text-caption)]" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)" }} role="status">No linked transactions.</div>;
  }

  return (
    <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)" }} role="region" aria-label="Linked Transactions">
      <TabSearchBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search transactions..."
        resultCount={filtered.length}
        resultLabel={`transaction${filtered.length !== 1 ? "s" : ""} · $${totalAmount.toLocaleString()}`}
      />
      <FilterPills pills={pills} active={filter} onSelect={setFilter} />

      <div style={{ padding: "0 var(--space-card-padding) var(--space-card-padding)" }} className="space-y-3">
        {SECTIONS.flatMap(sec => {
          const subGroups = sec.types.map(type => ({ type, items: filtered.filter(t => t.type === type) })).filter(g => g.items.length > 0);
          if (subGroups.length === 0) return [];
          return subGroups.map(({ type, items }) => {
            const meta = TYPE_META[type] || { icon: FileText, plural: type };
            const Icon = meta.icon;
            const sectionTotal = items.reduce((s, t) => s + t.amount, 0);
            const open = collapsed[type] !== true;
            return (
              <div key={type} className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <div className="flex items-center justify-between bg-secondary px-4">
                  <button onClick={() => toggle(type)} className="flex items-center gap-2 py-2.5 text-left hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls={`lt-${type}`}>
                    {open ? <ChevronDown className="w-4 h-4 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-foreground/50" aria-hidden="true" />}
                    <Icon className="w-4 h-4 text-foreground/50" aria-hidden="true" />
                    <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{meta.plural}</span>
                    <span className="text-[length:var(--text-small)] text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[18px] text-center font-medium">{items.length}</span>
                  </button>
                  {sectionTotal > 0 && <span className="text-[length:var(--text-caption)] text-foreground font-medium">${sectionTotal.toLocaleString()}</span>}
                </div>
                {open && (
                  <div className="overflow-x-auto bg-card" id={`lt-${type}`}>
                    <table className="w-full text-[length:var(--text-caption)] table-fixed" role="table" aria-label={`${meta.plural} list`}>
                      <thead>
                        <tr className="border-b border-border">
                          {[
                            { col: "NUMBER",      width: "15%", align: "text-left",  hide: "", tip: "Unique document reference number" },
                            { col: "DESCRIPTION", width: "28%", align: "text-left",  hide: "hidden sm:table-cell", tip: "Brief summary of the transaction" },
                            { col: "STATUS",      width: "13%", align: "text-left",  hide: "", tip: "Current lifecycle state of the document" },
                            { col: "DATE",        width: "13%", align: "text-left",  hide: "hidden md:table-cell", tip: "Date the document was created" },
                            { col: "AMOUNT",      width: "13%", align: "text-right", hide: "", tip: "Total monetary value of the transaction" },
                            { col: "CREATED BY",  width: "14%", align: "text-left",  hide: "hidden lg:table-cell", tip: "User who created this document" },
                          ].map(c => (
                            <th key={c.col} scope="col" className={`py-1.5 px-4 text-[length:var(--text-small)] text-foreground/50 whitespace-nowrap font-medium ${c.align} ${c.hide}`} style={{ width: c.width }}>
                              <ThTooltip label={c.col} tooltip={c.tip} />
                            </th>
                          ))}
                          <th className="w-[4%]"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(t => {
                          const ss = STATUS_STYLES[t.status] || STATUS_STYLES.Draft;
                          const ac = avatarColor(t.createdByInitials);
                          return (
                            <tr key={t.id} className="border-b border-border hover:bg-secondary transition-colors group">
                              <td className="py-2 px-4 pr-3">
                                <Tooltip text={`Open ${t.type} ${t.number}`} position="top">
                                  <button className="text-primary text-[length:var(--text-caption)] hover:underline font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Open ${t.number}`}><HighlightText text={t.number} search={search} /></button>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4 pr-3 hidden sm:table-cell">
                                <Tooltip text={t.description} position="top">
                                  <span className="text-[length:var(--text-caption)] text-foreground truncate block"><HighlightText text={t.description} search={search} /></span>
                                </Tooltip>
                                {t.reference && <span className="text-[length:var(--text-small)] text-foreground/35 ml-2 whitespace-nowrap">{t.reference}</span>}
                              </td>
                              <td className="py-2 px-4 pr-3">
                                <Tooltip text={`${t.type} is currently ${t.status}`} position="top">
                                  <span className={`inline-flex items-center px-2 py-[2px] rounded text-[length:var(--text-small)] font-medium ${ss.bg} ${ss.text}`}>{t.status}</span>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4 pr-3 text-[length:var(--text-caption)] text-foreground/50 whitespace-nowrap hidden md:table-cell">
                                <Tooltip text={`Created on ${t.date}`} position="top"><span>{t.date}</span></Tooltip>
                              </td>
                              <td className="py-2 px-4 pr-3 text-[length:var(--text-caption)] text-foreground whitespace-nowrap text-right font-medium">
                                <Tooltip text={t.amount > 0 ? `Transaction value: $${t.amount.toLocaleString()}` : "No monetary value"} position="top">
                                  <span>{t.amount > 0 ? `$${t.amount.toLocaleString()}` : "\u2014"}</span>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4 pr-3 hidden lg:table-cell">
                                <Tooltip text={`Created by ${t.createdBy}`} position="top">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[length:var(--text-micro)] shrink-0 font-semibold ${ac.bg} ${ac.text}`} aria-hidden="true">{t.createdByInitials}</span>
                                    <span className="text-[length:var(--text-caption)] text-foreground truncate max-w-[80px]"><HighlightText text={t.createdBy.split(" ")[0]} search={search} /></span>
                                  </div>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4">
                                <Tooltip text={`Copy ${t.number} to clipboard`} position="top">
                                  <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors opacity-40 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Copy ${t.number}`}>
                                    <Copy className="w-3 h-3 text-foreground/35" />
                                  </button>
                                </Tooltip>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}