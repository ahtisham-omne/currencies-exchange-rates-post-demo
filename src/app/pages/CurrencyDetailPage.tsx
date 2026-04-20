import { useParams, useNavigate } from "react-router-dom";
import { useCurrencies } from "../context/CurrencyContext";
import { useExchangeRates } from "../context/ExchangeRateContext";
import { BASE_CURRENCY } from "../data/exchangeRates";
import { useState, useEffect, useRef, useMemo } from "react";
import { getFlagUrl } from "../utils/currencyFlags";
import { countOpenDocuments, countInUse, hasOpenDocuments, type Currency } from "../data/currencies";
import {
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
  ArrowLeftRight,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { format, formatDistanceToNow } from "date-fns";

type DocSortKey = "ref" | "party" | "amount" | "status" | "date" | "type";

/** Rounded chip showing a currency symbol with a hover tooltip resolving the currency. */
function CurrencySymbolChip({
  symbol,
  name,
  code,
  size = "md",
}: {
  symbol: string;
  name: string;
  code: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg"
      ? "h-8 min-w-8 px-2.5 text-[16px]"
      : size === "sm"
      ? "h-5 min-w-[20px] px-1.5 text-[11px]"
      : "h-6 min-w-6 px-2 text-[13px]";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F1F5F9] text-[#0F172A] cursor-default tabular-nums ${dims}`}
          style={{ fontWeight: 600 }}
        >
          {symbol}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {name} ({code})
      </TooltipContent>
    </Tooltip>
  );
}

interface ConverterProps {
  detailCurrency: Currency;
}

/** Live exchange-rate converter between two active currencies. */
function CurrencyConverter({ detailCurrency }: ConverterProps) {
  const { currencies } = useCurrencies();
  const { midMarketRates, standardRates } = useExchangeRates();

  const activeCurrencies = useMemo(
    () => currencies.filter((c) => c.status === "active"),
    [currencies]
  );

  // Rate lookups are relative to BASE_CURRENCY (PKR). "1 X = rate[X] PKR".
  const midFor = (code: string): number | null => {
    if (code === BASE_CURRENCY) return 1;
    return midMarketRates.find((r) => r.sourceCurrency === code)?.rate ?? null;
  };
  const stdFor = (code: string): number | null => {
    if (code === BASE_CURRENCY) return 1;
    return standardRates.find((r) => r.sourceCurrency === code)?.standardRate ?? null;
  };

  // Default: from = detail currency, to = base. If detail currency IS base, default "to" to USD when possible.
  const defaultFrom = detailCurrency.code;
  const defaultTo = detailCurrency.code === BASE_CURRENCY
    ? (activeCurrencies.find((c) => c.code === "USD")?.code ?? BASE_CURRENCY)
    : BASE_CURRENCY;

  const [fromCode, setFromCode] = useState<string>(defaultFrom);
  const [toCode, setToCode] = useState<string>(defaultTo);
  const [useCorporate, setUseCorporate] = useState<boolean>(false);
  const [lastEdited, setLastEdited] = useState<"from" | "to">("from");
  const [fromAmount, setFromAmount] = useState<string>("1");
  const [toAmount, setToAmount] = useState<string>("");

  const fromCurrency = currencies.find((c) => c.code === fromCode) ?? detailCurrency;
  const toCurrency = currencies.find((c) => c.code === toCode) ?? detailCurrency;

  // The std toggle is only meaningful when a std rate exists for the non-base side(s) involved.
  const hasCorporate =
    (fromCode === BASE_CURRENCY || stdFor(fromCode) !== null) &&
    (toCode === BASE_CURRENCY || stdFor(toCode) !== null) &&
    !(fromCode === BASE_CURRENCY && toCode === BASE_CURRENCY);
  const rateMode: "mid" | "std" = useCorporate && hasCorporate ? "std" : "mid";

  // Effective "1 fromCode = rate toCode".
  const rate: number | null = useMemo(() => {
    const f = rateMode === "std" ? stdFor(fromCode) : midFor(fromCode);
    const t = rateMode === "std" ? stdFor(toCode) : midFor(toCode);
    if (f === null || t === null) return null;
    // 1 from = f base ; 1 to = t base ; so 1 from = f/t to.
    return f / t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, toCode, rateMode, midMarketRates, standardRates]);

  const fmt = (n: number, c: Currency) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: c.decimalPlaces,
      maximumFractionDigits: c.decimalPlaces,
    });

  // Recompute whichever side wasn't last edited.
  useEffect(() => {
    if (rate === null) {
      if (lastEdited === "from") setToAmount("");
      else setFromAmount("");
      return;
    }
    if (lastEdited === "from") {
      const n = Number(fromAmount.replace(/,/g, ""));
      if (Number.isFinite(n)) setToAmount(fmt(n * rate, toCurrency));
      else setToAmount("");
    } else {
      const n = Number(toAmount.replace(/,/g, ""));
      if (Number.isFinite(n)) setFromAmount(fmt(n / rate, fromCurrency));
      else setFromAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, fromCode, toCode]);

  const onFromChange = (v: string) => {
    setFromAmount(v);
    setLastEdited("from");
    if (rate === null) return;
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n) && v.trim() !== "") setToAmount(fmt(n * rate, toCurrency));
    else setToAmount("");
  };

  const onToChange = (v: string) => {
    setToAmount(v);
    setLastEdited("to");
    if (rate === null) return;
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n) && v.trim() !== "") setFromAmount(fmt(n / rate, fromCurrency));
    else setFromAmount("");
  };

  const swap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setLastEdited("from");
  };

  const CurrencySide = ({
    side,
    code,
    setCode,
    amount,
    onAmountChange,
  }: {
    side: "From" | "To";
    code: string;
    setCode: (c: string) => void;
    amount: string;
    onAmountChange: (v: string) => void;
  }) => {
    const c = currencies.find((x) => x.code === code);
    if (!c) return null;
    const flag = getFlagUrl(c.code, 80);
    return (
      <div className="flex-1 min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex items-center gap-3">
          {/* Left: flag + code/name (also acts as the currency selector) */}
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger
              className="h-auto min-h-0 flex-1 min-w-0 border-0 bg-transparent p-0 shadow-none hover:bg-[#EEF2F7] rounded-lg px-2 py-1.5 -mx-2 -my-1.5 [&>svg]:text-[#94A3B8]"
              aria-label={`Change ${side.toLowerCase()} currency`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <div
                  className="rounded-full overflow-hidden shrink-0 border border-white shadow-[0_0_0_1px_#E2E8F0]"
                  style={{ width: 36, height: 36 }}
                >
                  {flag ? (
                    <img src={flag} alt={`${c.code} flag`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#F1F5F9]" />
                  )}
                </div>
                <div className="min-w-0 flex flex-col">
                  <span
                    className="text-[14px] text-[#0F172A] tabular-nums leading-tight"
                    style={{ fontWeight: 700 }}
                  >
                    {c.code}
                  </span>
                  <span
                    className="text-[11px] text-[#64748B] leading-tight truncate"
                    style={{ fontWeight: 500 }}
                    title={c.name}
                  >
                    {c.name}
                  </span>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {activeCurrencies.map((cc) => (
                <SelectItem key={cc.code} value={cc.code}>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>{cc.code}</span>
                  <span className="text-[#64748B] ml-1.5">— {cc.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Right: amount label + input */}
          <div className="flex flex-col items-end shrink-0 min-w-[140px]">
            <span
              className="text-[10px] text-[#94A3B8] mb-1"
              style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Amount
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={rate === null ? "No rate" : "0"}
              disabled={rate === null}
              aria-label={`${side} amount`}
              className="h-10 text-[16px] bg-white border-[#E2E8F0] tabular-nums text-right"
              style={{ fontWeight: 600 }}
            />
          </div>
        </div>
      </div>
    );
  };

  const updatedAt = midMarketRates[0]?.effectiveDate ?? null;
  const updatedAgo = updatedAt
    ? (() => {
        try { return formatDistanceToNow(new Date(updatedAt), { addSuffix: true }); } catch { return updatedAt; }
      })()
    : null;

  const rateLabel = rateMode === "std" ? "corporate rate" : "mid-market rate";
  const rateDisplay = rate !== null
    ? `1 ${fromCode} = ${rate.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })} ${toCode}`
    : "rate unavailable";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl mb-4 shadow-sm">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>Live Exchange Rate Converter</h3>
          <p className="text-[12px] text-[#64748B] mt-0.5">Convert any active currency pair in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] ${hasCorporate ? "text-[#475569]" : "text-[#94A3B8]"}`} style={{ fontWeight: 500 }}>
            Corporate rate
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Switch
                  checked={rateMode === "std"}
                  onCheckedChange={setUseCorporate}
                  disabled={!hasCorporate}
                />
              </span>
            </TooltipTrigger>
            {!hasCorporate && (
              <TooltipContent side="top">
                No corporate rate is defined for this pair.
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-stretch gap-3">
          <CurrencySide side="From" code={fromCode} setCode={setFromCode} amount={fromAmount} onAmountChange={onFromChange} />
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={swap}
                  className="h-9 w-9 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:text-[#0A77FF] hover:border-[#BFDBFE] transition-colors cursor-pointer shadow-sm"
                  aria-label="Swap from and to currencies"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Swap direction</TooltipContent>
            </Tooltip>
          </div>
          <CurrencySide side="To" code={toCode} setCode={setToCode} amount={toAmount} onAmountChange={onToChange} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#64748B]">
          <RefreshCw className="w-3 h-3 text-[#94A3B8]" />
          <span>
            Using <span style={{ fontWeight: 600, color: "#0F172A" }}>{rateLabel}</span>
            {rate !== null && (
              <> : <span className="tabular-nums" style={{ fontWeight: 600, color: "#0F172A" }}>{rateDisplay}</span></>
            )}
            {updatedAgo && <> · Updated {updatedAgo}</>}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  const inUseCount = currency ? countInUse(currency) : 0;

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

  // Parse a numeric amount out of a formatted currency string (e.g. "$18,500.00" → 18500)
  const parseAmount = (amount: string): number => {
    const n = Number(amount.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // Format preview numeric portion (without symbol — symbol is rendered as a chip alongside)
  const formatPreviewAmount = (1000).toLocaleString(undefined, {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });



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

  // Per-document-type totals
  const fmtMoney = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    });

  const totalVendorInvoices = currency.usage.openInvoices.reduce((s, d) => s + parseAmount(d.amount), 0);
  const totalCustomerInvoices = currency.usage.openCustomerInvoices.reduce((s, d) => s + parseAmount(d.amount), 0);
  const totalPurchaseOrders = currency.usage.openPurchaseOrders.reduce((s, d) => s + parseAmount(d.amount), 0);
  const totalSalesOrders = currency.usage.openSalesOrders.reduce((s, d) => s + parseAmount(d.amount), 0);
  const totalPayments = payments.reduce((s, d) => s + parseAmount(d.amount), 0);

  const totalValueNumeric =
    totalVendorInvoices +
    totalCustomerInvoices +
    totalPurchaseOrders +
    totalSalesOrders +
    totalPayments;
  const totalValueFormatted = fmtMoney(totalValueNumeric);

  const perTypeTotals: Array<{ key: string; label: string; amount: number; count: number }> = [
    { key: "vendorInvoices", label: "Vendor Invoices", amount: totalVendorInvoices, count: currency.usage.openInvoices.length },
    { key: "customerInvoices", label: "Customer Invoices", amount: totalCustomerInvoices, count: currency.usage.openCustomerInvoices.length },
    { key: "purchaseOrders", label: "Purchase Orders", amount: totalPurchaseOrders, count: currency.usage.openPurchaseOrders.length },
    { key: "salesOrders", label: "Sales Orders", amount: totalSalesOrders, count: currency.usage.openSalesOrders.length },
    { key: "payments", label: "Payments", amount: totalPayments, count: payments.length },
  ];

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
                      <CurrencySymbolChip symbol={currency.symbol} name={currency.name} code={currency.code} size={isScrolled ? "sm" : "md"} />
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
              {([
                { label: "Currency Code", kind: "text", value: currency.code },
                { label: "Currency Name", kind: "text", value: currency.name },
                { label: "Symbol", kind: "symbol" },
                { label: "Format Preview", kind: "preview" },
                { label: "Decimal Places", kind: "text", value: String(currency.decimalPlaces) },
                { label: "Country / Region", kind: "text", value: currency.country },
              ] as const).map((field) => (
                <div key={field.label} className="px-5 py-3.5 border-b border-[#F1F5F9]">
                  <p className="text-[11px] text-[#94A3B8] mb-1" style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{field.label}</p>
                  {field.kind === "symbol" ? (
                    <CurrencySymbolChip symbol={currency.symbol} name={currency.name} code={currency.code} />
                  ) : field.kind === "preview" ? (
                    <div className="flex items-center gap-2">
                      <CurrencySymbolChip symbol={currency.symbol} name={currency.name} code={currency.code} />
                      <span className="text-[13px] text-[#0F172A] tabular-nums" style={{ fontWeight: 500 }}>{formatPreviewAmount}</span>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>{field.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Exchange Rate Converter */}
          <CurrencyConverter detailCurrency={currency} />

          {/* In Use Section */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl mb-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>In Use</h3>
                <div className="text-[12px] text-[#64748B]" style={{ fontWeight: 500 }}>
                  Total value across all documents:{" "}
                  <span className="inline-flex items-center gap-1.5 ml-0.5 align-middle">
                    <CurrencySymbolChip symbol={currency.symbol} name={currency.name} code={currency.code} />
                    <span className="text-[14px] text-[#0F172A] tabular-nums" style={{ fontWeight: 700 }}>{totalValueFormatted}</span>
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-[#64748B] mt-1.5">
                {inUseCount} active document{inUseCount !== 1 ? "s" : ""}
                {totalOpenDocs > 0 && <> · blocking deactivation</>}
                {" "}· Last transaction: {lastTransactionDate} · {docsInPast12Months} documents in the past 12 months
              </p>

              {/* Per-document-type totals */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {perTypeTotals.map((t) => {
                  const dim = t.count === 0;
                  return (
                    <div
                      key={t.key}
                      className={`rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 ${dim ? "opacity-70" : ""}`}
                    >
                      <p
                        className="text-[10px] text-[#94A3B8]"
                        style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                      >
                        {t.label}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <CurrencySymbolChip
                          symbol={currency.symbol}
                          name={currency.name}
                          code={currency.code}
                          size="sm"
                        />
                        <span
                          className="text-[13px] text-[#0F172A] tabular-nums"
                          style={{ fontWeight: 700 }}
                        >
                          {fmtMoney(t.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
                        {t.count} {t.count === 1 ? "document" : "documents"}
                      </p>
                    </div>
                  );
                })}
              </div>
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
