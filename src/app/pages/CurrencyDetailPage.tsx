import { useParams, useNavigate } from "react-router-dom";
import { useCurrencies } from "../context/CurrencyContext";
import { useState, useEffect, useRef, useMemo } from "react";
import { getFlagUrl } from "../utils/currencyFlags";
import { countOpenDocuments, hasOpenDocuments } from "../data/currencies";
import {
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Search,
  Coins,
  CircleSlash,
  CircleCheck,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip";
import { format } from "date-fns";
import type { OpenTransaction, PaymentTransaction } from "../data/currencies";

type DocSortKey = "ref" | "party" | "amount" | "status" | "date" | "type";

export function CurrencyDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { getCurrency, activateCurrency, deactivateCurrency } = useCurrencies();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [openDocsErrorOpen, setOpenDocsErrorOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [docSort, setDocSort] = useState<Record<string, { key: string; dir: "asc" | "desc" }>>({});
  const [activeDocTab, setActiveDocTab] = useState("vendorInvoices");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const currency = getCurrency(code?.toUpperCase() || "");

  const openDocs = currency ? hasOpenDocuments(currency) : false;
  const totalOpenDocs = currency ? countOpenDocuments(currency) : 0;

  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "-44px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!currency) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
          <Coins className="w-8 h-8 text-[#94A3B8]" />
        </div>
        <p className="text-[#64748B] text-sm">Currency not found.</p>
        <Button variant="outline" onClick={() => navigate("/accounting/currencies")} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back to Currency Library
        </Button>
      </div>
    );
  }

  const handleActivate = () => {
    activateCurrency(currency.code);
    toast.success(`${currency.code} activated`);
  };

  const handleDeactivateRequest = () => {
    if (openDocs) {
      setOpenDocsErrorOpen(true);
      return;
    }
    setDeactivateOpen(true);
  };

  const handleDeactivate = () => {
    deactivateCurrency(currency.code);
    toast.success(`${currency.code} deactivated`);
    setDeactivateOpen(false);
  };

  // Strip currency symbol from amount string, keeping only digits, commas, dots, spaces
  const stripSymbol = (amount: string) => amount.replace(/^[^0-9]*/, "");

  // Format preview helper
  const formatPreview = () => {
    const amount = (1000).toLocaleString(undefined, {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    });
    return `${currency.code} ${amount}`;
  };



  // Linked Documents sections
  type DocSection = {
    key: string;
    label: string;
    columns: { key: string; label: string }[];
    data: Array<Record<string, string>>;
  };

  const payments = currency.usage.openPayments || [];

  const allDocTabs: DocSection[] = [
    {
      key: "vendorInvoices",
      label: "Vendor Invoices",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Vendor" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: currency.usage.openInvoices.map(d => ({ ref: d.ref, party: d.vendor, amount: d.amount, status: d.status, date: d.date })),
    },
    {
      key: "customerInvoices",
      label: "Customer Invoices",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Customer" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: currency.usage.openCustomerInvoices.map(d => ({ ref: d.ref, party: d.vendor, amount: d.amount, status: d.status, date: d.date })),
    },
    {
      key: "purchaseOrders",
      label: "Purchase Orders",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Vendor" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: currency.usage.openPurchaseOrders.map(d => ({ ref: d.ref, party: d.vendor, amount: d.amount, status: d.status, date: d.date })),
    },
    {
      key: "salesOrders",
      label: "Sales Orders",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Customer" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: currency.usage.openSalesOrders.map(d => ({ ref: d.ref, party: d.vendor, amount: d.amount, status: d.status, date: d.date })),
    },
    {
      key: "vendorPayments",
      label: "Vendor Payments",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Party" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: payments.filter(d => d.type === "Vendor Payment").map(d => ({ ref: d.ref, party: d.party, amount: d.amount, status: "", date: d.date })),
    },
    {
      key: "customerPayments",
      label: "Customer Payments",
      columns: [
        { key: "ref", label: "Document Reference" },
        { key: "party", label: "Party" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      data: payments.filter(d => d.type === "Customer Payment").map(d => ({ ref: d.ref, party: d.party, amount: d.amount, status: "", date: d.date })),
    },
  ];


  // Last transaction date
  const allDates = [
    ...currency.usage.openInvoices.map(d => d.date),
    ...currency.usage.openCustomerInvoices.map(d => d.date),
    ...currency.usage.openPurchaseOrders.map(d => d.date),
    ...currency.usage.openSalesOrders.map(d => d.date),
    ...payments.map(d => d.date),
  ].filter(Boolean).sort().reverse();
  const lastTransactionDate = allDates[0] ? (() => { try { return format(new Date(allDates[0]), "dd MMM yyyy"); } catch { return allDates[0]; } })() : "N/A";

  // Total docs in past 12 months (simulated as totalLifetimeDocuments for demo)
  const docsInPast12Months = currency.usage.totalLifetimeDocuments;


  const handleSectionSort = (sectionKey: string, colKey: string) => {
    setDocSort(prev => {
      const current = prev[sectionKey];
      if (current?.key === colKey) {
        return { ...prev, [sectionKey]: { key: colKey, dir: current.dir === "asc" ? "desc" : "asc" } };
      }
      return { ...prev, [sectionKey]: { key: colKey, dir: "asc" } };
    });
  };

  const getSortedData = (section: DocSection) => {
    const sort = docSort[section.key];
    if (!sort) return section.data;
    const sorted = [...section.data];
    sorted.sort((a, b) => {
      const cmp = (a[sort.key] || "").localeCompare(b[sort.key] || "");
      return sort.dir === "desc" ? -cmp : cmp;
    });
    return sorted;
  };

  // Status config
  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    inactive: { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", label: "Inactive" },
  };
  const currentStatus = statusConfig[currency.status] || statusConfig.active;

  const StatusPill = ({ compact = false }: { compact?: boolean }) => (
    <span
      className={`inline-flex items-center rounded-full border ${compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
      style={{ fontWeight: 500, backgroundColor: currentStatus.bg, color: currentStatus.color, borderColor: currentStatus.border }}
    >
      {currentStatus.label}
    </span>
  );


  const StatusActionButton = ({ compact = false }: { compact?: boolean }) => {
    if (currency.status === "active" && !currency.isBaseCurrency) {
      if (openDocs) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled
                className={`rounded-lg bg-[#DC2626]/50 text-white/70 inline-flex items-center gap-1.5 cursor-not-allowed shadow-sm ${compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
                style={{ fontWeight: 600 }}
              >
                <CircleSlash className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                Deactivate
              </button>
            </TooltipTrigger>
            <TooltipContent>Cannot deactivate — open documents exist</TooltipContent>
          </Tooltip>
        );
      }
      return (
        <button
          onClick={handleDeactivateRequest}
          className={`rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
          style={{ fontWeight: 600 }}
        >
          <CircleSlash className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Deactivate
        </button>
      );
    }
    if (currency.status === "inactive") {
      return (
        <button
          onClick={handleActivate}
          className={`rounded-lg bg-[#059669] hover:bg-[#047857] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
          style={{ fontWeight: 600 }}
        >
          <CircleCheck className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Activate
        </button>
      );
    }
    return null;
  };

  // Status pill for documents
  const docStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === "open") return { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" };
    if (s === "paid" || s === "closed") return { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" };
    if (s === "overdue") return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
    if (s === "draft") return { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };
    if (s === "pending") return { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" };
    if (s.includes("partial")) return { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" };
    return { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };
  };

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC]">
      {/* TOP NAV BAR */}
      <div className="bg-white border-b border-[#E2E8F0] shrink-0 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-11">
          <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
            <button onClick={() => navigate("/accounting")} className="hover:text-[#0F172A] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              Currencies & Exchange Rates
            </button>
            <span className="text-[#CBD5E1]">/</span>
            <button onClick={() => navigate("/accounting/currencies")} className="hover:text-[#0F172A] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              Currency Library
            </button>
            <span className="text-[#CBD5E1]">/</span>
            <span className="text-[#0F172A]" style={{ fontWeight: 500 }}>{currency.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input placeholder="Search currency..." className="pl-9 w-[220px] h-8 bg-[#F8FAFC] border-[#E2E8F0] text-[13px] placeholder:text-[#94A3B8] rounded-lg" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 border-[#E2E8F0]" style={{ backgroundColor: '#0A77FF' }}>
                <span className="text-[11px] text-white" style={{ fontWeight: 600 }}>AA</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
                <p className="text-[11px] text-[#94A3B8] leading-tight">Product Designer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* STICKY HEADER */}
      <div className="shrink-0 sticky top-[44px] z-20 bg-[#F8FAFC]">
        <div style={{ paddingTop: isScrolled ? "8px" : "12px", paddingBottom: "4px", transition: "padding-top 250ms ease" }}>
          <div className="mx-auto px-4 lg:px-6 xl:px-8 max-w-[1440px] 2xl:max-w-[1600px]">
            <div className={`bg-white border border-[#E2E8F0] rounded-xl overflow-hidden transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}>
              <div className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out" style={{ padding: isScrolled ? "6px 16px" : "12px 16px" }}>
                {/* Left */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button onClick={() => navigate("/accounting/currencies")} className="rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] transition-all duration-250" style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}>
                    <ChevronLeft className="text-[#94A3B8] transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>
                  <div className="rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_0_0_2px_rgba(10,119,255,0.10)] transition-all duration-250" style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}>
                    <img src={getFlagUrl(currency.code, 80)} alt={`${currency.code} flag`} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1 className="text-[#0F172A] truncate transition-all duration-250" style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? "18px" : "22px" }}>
                        {currency.code} — {currency.name}
                      </h1>
                      <StatusPill compact={isScrolled} />
                      {currency.isBaseCurrency && (
                        <span className={`inline-flex items-center rounded-full border transition-all duration-250 ${isScrolled ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"}`} style={{ fontWeight: 500, color: "#92400E", backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }}>
                          Base Currency
                        </span>
                      )}
                    </div>
                    <div className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl" style={{ maxHeight: isScrolled ? 0 : 20, opacity: isScrolled ? 0 : 1, marginTop: isScrolled ? 0 : 4 }}>
                      <p className="text-[12px] text-[#64748B] leading-[1.6]">
                        {currency.country} · {currency.decimalPlaces} decimal places
                      </p>
                    </div>
                  </div>
                </div>
                {/* Right */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  <StatusActionButton compact={isScrolled} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none transition-opacity duration-300" style={{ height: 8, background: "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)", opacity: isScrolled ? 1 : 0 }} />
      </div>

      {/* CONTENT */}
      <div className="flex-1">
        <div className="mx-auto px-4 lg:px-6 xl:px-8 max-w-[1440px] 2xl:max-w-[1600px] py-4">
          {/* Currency Information Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl mb-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>Currency Information</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0">
              {[
                { label: "Currency Code", value: currency.code },
                { label: "Currency Name", value: currency.name },
                { label: "Symbol", value: currency.symbol },
                { label: "Format Preview", value: formatPreview() },
                { label: "Decimal Places", value: String(currency.decimalPlaces) },
                { label: "Country / Region", value: currency.country },
              ].map((field) => (
                <div key={field.label} className="px-5 py-3.5 border-b border-[#F1F5F9]">
                  <p className="text-[11px] text-[#94A3B8] mb-1" style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{field.label}</p>
                  <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Documents Section */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl mb-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>Linked Documents</h3>
              <p className="text-[12px] text-[#64748B] mt-1">
                {totalOpenDocs} open document{totalOpenDocs !== 1 ? "s" : ""} blocking deactivation · Last transaction: {lastTransactionDate} · {docsInPast12Months} documents in the past 12 months
              </p>
            </div>

            <div className="border-b border-[#E2E8F0] px-5">
              <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {allDocTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDocTab(tab.key)}
                    className={`relative px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                      activeDocTab === tab.key
                        ? "text-[#0A77FF]"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                    style={{ fontWeight: activeDocTab === tab.key ? 600 : 500 }}
                  >
                    <span className="flex items-center gap-1.5">
                      {tab.label}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                        style={{
                          fontWeight: 600,
                          backgroundColor: activeDocTab === tab.key ? "#EDF4FF" : "#F1F5F9",
                          color: activeDocTab === tab.key ? "#0A77FF" : "#94A3B8",
                        }}
                      >
                        {tab.data.length}
                      </span>
                    </span>
                    {activeDocTab === tab.key && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0A77FF] rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const section = allDocTabs.find(t => t.key === activeDocTab);
              if (!section) return null;
              const sortState = docSort[section.key];
              const sortedData = getSortedData(section);

              if (sortedData.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
                    <Inbox className="w-10 h-10 mb-3" />
                    <p className="text-[14px] text-[#64748B]" style={{ fontWeight: 500 }}>
                      No {section.label.toLowerCase()} found for this currency.
                    </p>
                    <p className="text-[12px] text-[#94A3B8] mt-1">
                      {section.label} using {currency.code} will appear here.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                        {section.columns.map(col => (
                          <TableHead key={col.key}>
                            <button
                              onClick={() => handleSectionSort(section.key, col.key)}
                              className="inline-flex items-center gap-1 text-[12px] hover:text-[#0F172A] transition-colors"
                              style={{ fontWeight: 600, color: sortState?.key === col.key ? "#0A77FF" : undefined }}
                            >
                              {col.label}
                              {sortState?.key === col.key && sortState.dir === "asc" && <ArrowUp className="w-3 h-3" style={{ color: "#0A77FF" }} />}
                              {sortState?.key === col.key && sortState.dir === "desc" && <ArrowDown className="w-3 h-3" style={{ color: "#0A77FF" }} />}
                              {sortState?.key !== col.key && <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />}
                            </button>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((doc, i) => (
                        <TableRow key={doc.ref + i}>
                          <TableCell>
                            <span className="text-[13px] text-[#0A77FF] cursor-pointer hover:underline" style={{ fontWeight: 600 }}>{doc.ref}</span>
                          </TableCell>
                          <TableCell className="text-[13px]">{doc.party}</TableCell>
                          <TableCell className="text-[13px] tabular-nums" style={{ fontWeight: 500 }}>{currency.code} {stripSymbol(doc.amount)}</TableCell>
                          <TableCell>
                            {doc.status ? (() => {
                              const ss = docStatusStyle(doc.status);
                              return (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ fontWeight: 500, color: ss.color, backgroundColor: ss.bg, borderColor: ss.border }}>
                                  {doc.status}
                                </span>
                              );
                            })() : <span className="text-[12px] text-[#94A3B8]">—</span>}
                          </TableCell>
                          <TableCell className="text-[12px] text-[#64748B] tabular-nums">
                            {(() => {
                              try { return format(new Date(doc.date), "dd MMM yyyy"); } catch { return doc.date; }
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </div>

          {/* Audit Log Section */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl mb-6 shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>Audit Log</h3>
            </div>
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <TableHead className="text-[12px] min-w-[160px]" style={{ fontWeight: 600 }}>Date & Time</TableHead>
                    <TableHead className="text-[12px] min-w-[120px]" style={{ fontWeight: 600 }}>Action</TableHead>
                    <TableHead className="text-[12px] min-w-[140px]" style={{ fontWeight: 600 }}>Changed By</TableHead>
                    <TableHead className="text-[12px]" style={{ fontWeight: 600 }}>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currency.auditLog.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[12px] text-[#64748B] tabular-nums">
                        {format(new Date(entry.dateTime), "MMM dd, yyyy — HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {entry.action === "Activated" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          {entry.action === "Deactivated" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                          {entry.action === "System" && <Info className="w-3.5 h-3.5 text-primary" />}
                          <span className="text-[12px]" style={{ fontWeight: 500 }}>{entry.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[12px]">{entry.changedBy}</TableCell>
                      <TableCell className="text-[12px] text-[#64748B]">{entry.reason || "No reason provided"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {currency.code} — {currency.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-[13px]">
                  Are you sure you want to deactivate <strong>{currency.code}</strong>? It will no longer be available for new transactions.
                </p>
                <p className="text-[12px] text-muted-foreground">
                  This action will take effect immediately. You can re-activate at any time.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Open Docs Error Dialog */}
      <AlertDialog open={openDocsErrorOpen} onOpenChange={setOpenDocsErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cannot Deactivate Currency
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-[13px]">This currency has open documents that must be resolved before deactivation.</p>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5">
                  {currency.usage.openInvoices.length > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#64748B]">Open Vendor Invoices:</span>
                      <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{currency.usage.openInvoices.length}</span>
                    </div>
                  )}
                  {currency.usage.openCustomerInvoices.length > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#64748B]">Open Customer Invoices:</span>
                      <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{currency.usage.openCustomerInvoices.length}</span>
                    </div>
                  )}
                  {currency.usage.openPurchaseOrders.length > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#64748B]">Open Purchase Orders:</span>
                      <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{currency.usage.openPurchaseOrders.length}</span>
                    </div>
                  )}
                  {currency.usage.openSalesOrders.length > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#64748B]">Open Sales Orders:</span>
                      <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{currency.usage.openSalesOrders.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Understood</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
