import { useState, useMemo } from "react";
import {
  ChevronDown, FileText, ShoppingCart, FileCheck,
  ClipboardList, Truck, PackageCheck, Copy, Link2,
} from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { InfoTooltip } from "@/app/components/ui/info-tooltip";
import { NumberPill } from "@/app/components/shared/NumberPill";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
import { ThTooltip, Tooltip } from "./Tooltip";
import type { LinkedTransaction } from "./types";
import { useDocCurrency } from "@/app/components/currency/docCurrencyContext";
import { convertOn, localTodayIso } from "@/app/currency/soFx";
import { formatWhole } from "./soMoney";

const TYPE_META: Record<string, { icon: typeof FileText; plural: string }> = {
  Quote: { icon: ShoppingCart, plural: "Source Quotes" },
  Contract: { icon: FileCheck, plural: "Customer Contracts" },
  "Pick Ticket": { icon: ClipboardList, plural: "Pick Tickets" },
  Shipment: { icon: Truck, plural: "Shipment Documents" },
  "Delivery Confirmation": { icon: PackageCheck, plural: "Delivery Confirmations" },
  Return: { icon: FileText, plural: "Return Documents" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Converted: { bg: "bg-success/10", text: "text-success" }, Active: { bg: "bg-success/10", text: "text-success" },
  Completed: { bg: "bg-success/10", text: "text-success" }, Shipped: { bg: "bg-primary/10", text: "text-primary" },
  Delivered: { bg: "bg-success/10", text: "text-success" }, Invoiced: { bg: "bg-chart-4/10", text: "text-chart-4" },
  Paid: { bg: "bg-success/10", text: "text-success" }, "Partially Paid": { bg: "bg-chart-3/10", text: "text-chart-3" },
  Issued: { bg: "bg-primary/10", text: "text-primary" }, "In Progress": { bg: "bg-primary/10", text: "text-primary" },
  Draft: { bg: "bg-secondary", text: "text-foreground/70" }, Pending: { bg: "bg-chart-3/10", text: "text-chart-3" },
  Cancelled: { bg: "bg-destructive/10", text: "text-destructive" },
};

const AVATAR_COLORS = [
  { bg: "bg-success/10", text: "text-success" }, { bg: "bg-chart-3/10", text: "text-chart-3" },
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

interface Props { transactions: LinkedTransaction[]; createdViaUI?: boolean; }

export function LinkedTransactionsTab({ transactions, createdViaUI = false }: Props) {
  /* Documents are in the order's currency unless they carry their own (a
     quote, or one raised before the order's currency changed); section
     totals add them up in the order's currency. */
  const { currency, fx, rateDate } = useDocCurrency();
  const inOrder = (t: { amount: number; currency?: string }) =>
    t.currency && t.currency.toUpperCase() !== currency ? convertOn(t.amount, t.currency, currency, fx?.rateDate ?? rateDate ?? localTodayIso()) : t.amount;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  /* Filter out Invoice / Payment Receipt / Credit Memo — those live in Invoicing tab now */
  const EXCLUDED_TYPES = ["Invoice", "Credit Memo", "Payment Receipt"];
  const txns = useMemo(() => createdViaUI ? [] : transactions.filter(t => !EXCLUDED_TYPES.includes(t.type)), [transactions, createdViaUI]);

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
    return (
      <EmptyPlaceholder
        block
        icon={Link2}
        title="No linked transactions yet"
        description="Other Omne records that reference this sales order will appear here, including the source quote, procurement orders, shipments, invoices, returns, and credit memos."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} role="region" aria-label="Linked Transactions">
      {/* ── Toolbar card ── */}
      <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)", overflow: "visible", position: "relative", zIndex: 5 }}>
        <TabSearchBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search transactions..."
          resultCount={filtered.length}
          resultLabel={`transaction${filtered.length !== 1 ? "s" : ""}`}
          resultTooltip={
            <InfoTooltip side="bottom">
              Links to the documents connected to this Sales Order across the order-to-cash chain: RFQs, quotes, shipment documents, invoices, credit memos, and payment receipts. Open any link to go straight to that document.
            </InfoTooltip>
          }
        />
        <FilterPills pills={pills} active={filter} onSelect={setFilter} />
      </div>

      {/* ── Independent section cards ── */}
      {SECTIONS.flatMap(sec => {
          const subGroups = sec.types.map(type => ({ type, items: filtered.filter(t => t.type === type) })).filter(g => g.items.length > 0);
          if (subGroups.length === 0) return [];
          return subGroups.map(({ type, items }) => {
            const meta = TYPE_META[type] || { icon: FileText, plural: type };
            const Icon = meta.icon;
            const sectionTotal = items.reduce((s, t) => s + inOrder(t), 0);
            const open = collapsed[type] !== true;
            return (
              <div key={type} className="bg-card border border-border overflow-hidden rounded-xl" style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}>
                <button
                  type="button"
                  onClick={() => toggle(type)}
                  className="w-full flex items-center gap-2 cursor-pointer hover:bg-[#F4F6F9] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  style={{ padding: "10px 14px", borderBottom: open ? "1px solid #EEF2F6" : "none", background: "#FAFBFC" }}
                  aria-expanded={open}
                  aria-controls={`lt-${type}`}
                >
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-foreground text-left" style={{ fontSize: 13, fontWeight: 600 }}>
                    {meta.plural}
                  </span>
                  <NumberPill count={items.length} />
                  {sectionTotal > 0 && (
                    <span className="text-foreground ml-auto" style={{ fontSize: 12, fontWeight: 500 }}>
                      {formatWhole(sectionTotal, currency)}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ${sectionTotal > 0 ? "" : "ml-auto"}`}
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <div className="overflow-x-auto bg-card" id={`lt-${type}`}>
                    <table className="w-full text-[length:var(--text-caption)] table-fixed" role="table" aria-label={`${meta.plural} list`}>
                      <thead>
                        <tr className="border-b border-border">
                          {[
                            { col: "Number",      width: "15%", align: "text-left",  hide: "", tip: "Unique document reference number" },
                            { col: "Description", width: "28%", align: "text-left",  hide: "hidden sm:table-cell", tip: "Brief summary of the transaction" },
                            { col: "Status",      width: "13%", align: "text-left",  hide: "", tip: "Current lifecycle state of the document" },
                            { col: "Created On",  width: "13%", align: "text-left",  hide: "hidden md:table-cell", tip: "Date the document was created" },
                            { col: "Amount",      width: "13%", align: "text-right", hide: "", tip: "Total monetary value of the transaction" },
                            { col: "Created By",  width: "14%", align: "text-left",  hide: "hidden lg:table-cell", tip: "User who created this document" },
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
                                {t.reference && <span className="text-[length:var(--text-small)] text-muted-foreground ml-2 whitespace-nowrap">{t.reference}</span>}
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
                                <Tooltip text={t.amount > 0 ? `Transaction value: ${formatWhole(t.amount, t.currency || currency)}` : "No monetary value"} position="top">
                                  <span>{t.amount > 0 ? formatWhole(t.amount, t.currency || currency) : "\u2014"}</span>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4 pr-3 hidden lg:table-cell">
                                <Tooltip text={`Created by ${t.createdBy}`} position="top">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[length:var(--text-micro)] shrink-0 font-semibold ${ac.bg} ${ac.text}`} aria-hidden="true">{t.createdByInitials}</span>
                                    <span className="text-[length:var(--text-caption)] text-foreground truncate"><HighlightText text={t.createdBy} search={search} /></span>
                                  </div>
                                </Tooltip>
                              </td>
                              <td className="py-2 px-4">
                                <Tooltip text={`Copy ${t.number} to clipboard`} position="top">
                                  <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors opacity-40 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Copy ${t.number}`}>
                                    <Copy className="w-3 h-3 text-muted-foreground" />
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
  );
}