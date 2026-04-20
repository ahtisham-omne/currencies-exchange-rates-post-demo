import { useParams, useNavigate } from "react-router-dom";
import { useCurrencies } from "../context/CurrencyContext";
import { useExchangeRates } from "../context/ExchangeRateContext";
import { BASE_CURRENCY, API_PROVIDER } from "../data/exchangeRates";
import { useState, useEffect, useRef, useMemo } from "react";
import { getFlagUrl } from "../utils/currencyFlags";
import { countOpenDocuments, countInUse, hasOpenDocuments, type Currency } from "../data/currencies";
import {
  CONVERTER_SUBTITLE,
  CONVERTER_TOGGLE_TOOLTIPS,
  RATE_TOOLTIPS,
} from "../utils/rateCopy";
import {
  ChevronLeft,
  ChevronDown,
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
  Plus,
  Check,
  X,
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
      ? "h-7 min-w-7 px-2 text-[14px]"
      : size === "sm"
      ? "h-[18px] min-w-[18px] px-1 text-[10px]"
      : "h-5 min-w-5 px-1.5 text-[12px]";
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

/** Compact dropdown that doubles as a currency picker AND a search box.
 * Looks like an input field so it lines up with the amount field on the
 * right. Opening the dropdown reveals a search input and a filterable list. */
function CurrencyComboBox({
  value,
  onChange,
  currencies,
  ariaLabel,
  compact = false,
}: {
  value: string;
  onChange: (code: string) => void;
  currencies: Currency[];
  ariaLabel?: string;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => currencies.find(c => c.code === value) ?? null,
    [currencies, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.country?.toLowerCase().includes(q) ?? false)
    );
  }, [currencies, query]);

  useEffect(() => {
    if (!open) return;
    // Focus the search input the moment the popover opens.
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset the search query whenever the popover closes so the next open
  // starts fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const flag = selected ? getFlagUrl(selected.code, 80) : "";
  const flagSize = compact ? 22 : 28;
  const inputH = compact ? "h-8" : "h-10";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 w-full ${inputH} px-2.5 rounded-md border bg-white text-left transition-colors ${
          open ? "border-primary/40 ring-2 ring-primary/10" : "border-[#E2E8F0] hover:border-[#CBD5E1]"
        }`}
      >
        {selected && (
          <div
            className="rounded-full overflow-hidden shrink-0 border border-white shadow-[0_0_0_1px_#E2E8F0]"
            style={{ width: flagSize, height: flagSize }}
          >
            {flag ? (
              <img src={flag} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#F1F5F9]" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-col leading-tight">
          {selected ? (
            <>
              <span
                className={`text-[#0F172A] tabular-nums truncate ${compact ? "text-[12px]" : "text-[13px]"}`}
                style={{ fontWeight: 700 }}
              >
                {selected.code}
              </span>
              {!compact && (
                <span
                  className="text-[11px] text-[#64748B] truncate"
                  style={{ fontWeight: 500 }}
                  title={selected.name}
                >
                  {selected.name}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-[#94A3B8]">Select currency</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-lg border border-[#E2E8F0] bg-white shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] overflow-hidden min-w-[260px]">
          <div className="relative border-b border-[#F1F5F9]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency, code, or country..."
              className="w-full h-9 pl-8 pr-8 text-[12.5px] outline-none placeholder:text-[#94A3B8]"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[#94A3B8]">No currencies match your search.</p>
            ) : (
              filtered.map(c => {
                const f = getFlagUrl(c.code, 80);
                const isActive = c.code === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                      isActive ? "bg-primary/[0.06] text-primary" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div
                      className="rounded-full overflow-hidden shrink-0 border border-white shadow-[0_0_0_1px_#E2E8F0]"
                      style={{ width: 20, height: 20 }}
                    >
                      {f ? (
                        <img src={f} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#F1F5F9]" />
                      )}
                    </div>
                    <span className="tabular-nums shrink-0" style={{ fontWeight: 600 }}>{c.code}</span>
                    <span className="text-[#64748B] truncate min-w-0">{c.name}</span>
                    {isActive && <Check className="w-3.5 h-3.5 ml-auto text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ConverterProps {
  detailCurrency: Currency;
  /** Compact variant for the page header — drops the title row, tightens padding. */
  compact?: boolean;
}

/** Live exchange-rate converter between two active currencies. */
function CurrencyConverter({ detailCurrency, compact = false }: ConverterProps) {
  const navigate = useNavigate();
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
    const r = standardRates.find((rr) => rr.sourceCurrency === code && rr.status === "active");
    return r?.standardRate ?? null;
  };
  const stdRecordFor = (code: string) =>
    standardRates.find((rr) => rr.sourceCurrency === code && rr.status === "active") ?? null;

  // Default: from = detail currency, to = base. If detail currency IS base, default "to" to USD when possible.
  const defaultFrom = detailCurrency.code;
  const defaultTo = detailCurrency.code === BASE_CURRENCY
    ? (activeCurrencies.find((c) => c.code === "USD")?.code ?? BASE_CURRENCY)
    : BASE_CURRENCY;

  const [fromCode, setFromCode] = useState<string>(defaultFrom);
  const [toCode, setToCode] = useState<string>(defaultTo);
  // Explicit segmented selection — defaults to mid-market.
  const [rateMode, setRateMode] = useState<"mid" | "std">("mid");
  // Tracks whether the user has flipped direction via the swap button so the
  // footer can call out the inverse view and the swap button can show an
  // active state. Resets when either side changes via the dropdown.
  const [isSwapped, setIsSwapped] = useState(false);
  const [lastEdited, setLastEdited] = useState<"from" | "to">("from");
  const [fromAmount, setFromAmount] = useState<string>("1");
  const [toAmount, setToAmount] = useState<string>("");

  const fromCurrency = currencies.find((c) => c.code === fromCode) ?? detailCurrency;
  const toCurrency = currencies.find((c) => c.code === toCode) ?? detailCurrency;

  // The corporate option is only meaningful when a std rate exists for the
  // non-base side(s) involved.
  const hasCorporate =
    (fromCode === BASE_CURRENCY || stdFor(fromCode) !== null) &&
    (toCode === BASE_CURRENCY || stdFor(toCode) !== null) &&
    !(fromCode === BASE_CURRENCY && toCode === BASE_CURRENCY);

  // Effective "1 fromCode = rate toCode". When corporate is selected but no
  // corp rate exists for the pair we silently fall back to mid so the cards
  // still convert; the empty state below the cards prompts the user to add one.
  const effectiveMode: "mid" | "std" = rateMode === "std" && hasCorporate ? "std" : "mid";
  const rate: number | null = useMemo(() => {
    const f = effectiveMode === "std" ? stdFor(fromCode) : midFor(fromCode);
    const t = effectiveMode === "std" ? stdFor(toCode) : midFor(toCode);
    if (f === null || t === null) return null;
    return f / t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, toCode, effectiveMode, midMarketRates, standardRates]);

  // Format an amount in a currency. Normally we use the currency's natural
  // decimal precision (e.g. 2 for USD), but for sub-unit values that would
  // round to "0.00" we expand precision so the user can read the real number
  // (e.g. inverse rates like 0.003590 USD).
  const fmt = (n: number, c: Currency) => {
    const baseDp = c.decimalPlaces;
    const abs = Math.abs(n);
    const naturalThreshold = Math.pow(10, -baseDp); // 0.01 for USD, 1 for JPY
    if (abs > 0 && abs < naturalThreshold) {
      const leadingZeros = Math.floor(-Math.log10(abs));
      const dp = Math.min(8, leadingZeros + 4);
      return n.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });
    }
    return n.toLocaleString(undefined, {
      minimumFractionDigits: baseDp,
      maximumFractionDigits: baseDp,
    });
  };

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

  const handleSetFromCode = (c: string) => {
    setFromCode(c);
    setIsSwapped(false);
  };
  const handleSetToCode = (c: string) => {
    setToCode(c);
    setIsSwapped(false);
  };

  // The swap button keeps the currencies in their visual positions and only
  // flips which side anchors the "1". Default: From = 1, To = rate. Inverse:
  // To = 1, From = 1/rate. This mirrors how an inverse rate is read.
  const swap = () => {
    setIsSwapped(prev => {
      const next = !prev;
      if (rate === null) return next;
      if (next) {
        setToAmount("1");
        setFromAmount(fmt(1 / rate, fromCurrency));
        setLastEdited("to");
      } else {
        setFromAmount("1");
        setToAmount(fmt(rate, toCurrency));
        setLastEdited("from");
      }
      return next;
    });
  };

  // The non-base side identifies the relevant currency pair for footer copy.
  const pairCode =
    fromCode === BASE_CURRENCY
      ? toCode
      : toCode === BASE_CURRENCY
      ? fromCode
      : fromCode; // cross-pair: fall back to the from side
  const stdRecord = stdRecordFor(pairCode);
  const midRecord = midMarketRates.find(r => r.sourceCurrency === pairCode) ?? null;

  const fmtTimestamp = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const tz = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(d)
        .find(p => p.type === "timeZoneName")?.value ?? "";
      return `${format(d, "dd MMM yyyy")} at ${format(d, "HH:mm")}${tz ? ` ${tz}` : ""}`;
    } catch {
      return iso;
    }
  };

  const rateDisplay = rate !== null
    ? (isSwapped
        ? `1 ${toCode} = ${(1 / rate).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })} ${fromCode}`
        : `1 ${fromCode} = ${rate.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })} ${toCode}`)
    : "rate unavailable";

  // True empty state: user explicitly picked Corporate but no corp rate exists.
  const showCorporateEmptyState = rateMode === "std" && !hasCorporate;

  const handleSetCorporate = () => {
    navigate(`/accounting/exchange-rates?addCorp=${encodeURIComponent(pairCode)}`);
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
    return (
      <div className={`flex-1 min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] ${compact ? "p-2.5" : "p-4"}`}>
        <div className={`flex items-end ${compact ? "gap-2" : "gap-3"}`}>
          {/* Currency selector — left, fills available width */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!compact && (
              <span
                className="text-[10px] text-[#94A3B8] mb-1"
                style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Currency
              </span>
            )}
            <CurrencyComboBox
              value={code}
              onChange={setCode}
              currencies={activeCurrencies}
              ariaLabel={`Change ${side.toLowerCase()} currency`}
              compact={compact}
            />
          </div>

          {/* Amount input — right */}
          <div className={`flex flex-col shrink-0 ${compact ? "min-w-[110px]" : "min-w-[160px]"}`}>
            {!compact && (
              <span
                className="text-[10px] text-[#94A3B8] mb-1"
                style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Amount
              </span>
            )}
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={rate === null ? "No rate" : "0"}
              disabled={rate === null}
              aria-label={`${side} amount`}
              className={`bg-white border-[#E2E8F0] tabular-nums text-right ${compact ? "h-8 text-[13px]" : "h-10 text-[16px]"}`}
              style={{ fontWeight: 600 }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={compact ? "" : "bg-white border border-[#E2E8F0] rounded-xl shadow-sm mb-4"}>
      {!compact && (
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>Live Exchange Rate Converter</h3>
            <p className="text-[12px] text-[#64748B] mt-0.5 max-w-[640px]">{CONVERTER_SUBTITLE}</p>
          </div>
          <RateSegmentedToggle
            mode={rateMode}
            onChange={setRateMode}
            corporateAvailable={hasCorporate}
          />
        </div>
      )}

      <div className={compact ? "px-3 py-3 space-y-2" : "px-5 py-4"}>
        {compact && (
          <div className="flex items-center justify-end">
            <RateSegmentedToggle
              mode={rateMode}
              onChange={setRateMode}
              corporateAvailable={hasCorporate}
              compact
            />
          </div>
        )}

        <div className={`flex items-stretch ${compact ? "gap-2" : "gap-3"}`}>
          <CurrencySide side="From" code={fromCode} setCode={handleSetFromCode} amount={fromAmount} onAmountChange={onFromChange} />
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={swap}
                  aria-pressed={isSwapped}
                  aria-label="Swap from and to currencies"
                  className={`rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-sm ${
                    compact ? "h-7 w-7" : "h-9 w-9"
                  } ${
                    isSwapped
                      ? "bg-[#0A77FF] text-white border border-[#0A77FF] hover:bg-[#0862D0]"
                      : "bg-white text-[#64748B] border border-[#E2E8F0] hover:text-[#0A77FF] hover:border-[#BFDBFE]"
                  }`}
                >
                  <ArrowLeftRight className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isSwapped ? "Inverse direction — click to restore" : "Swap direction"}
              </TooltipContent>
            </Tooltip>
          </div>
          <CurrencySide side="To" code={toCode} setCode={handleSetToCode} amount={toAmount} onAmountChange={onToChange} />
        </div>

        {/* Corporate empty state — shown when user explicitly picked Corporate
           but no corp rate exists for this pair. Mid-market keeps converting. */}
        {showCorporateEmptyState && (
          <div className={`mt-3 rounded-lg border border-dashed border-[#FDE68A] bg-[#FFFBEB] flex items-start gap-3 ${compact ? "p-2.5" : "p-3"}`}>
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 border border-[#FDE68A]">
              <Info className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-[#92400E]" style={{ fontWeight: 600 }}>
                No corporate rate has been set for this currency pair yet.
              </p>
              <p className="text-[11.5px] text-[#92400E]/85 mt-0.5">
                The mid-market rate is being used by default.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSetCorporate}
              className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-md bg-[#D97706] hover:bg-[#B45309] text-white text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3 h-3" />
              Set Corporate Rate
            </button>
          </div>
        )}

        {/* Adaptive footer — precise timestamp, attribution, inverse tag. */}
        <div className={`mt-3 flex items-center gap-1.5 text-[12px] text-[#64748B] flex-wrap`}>
          <span>
            Using{" "}
            <span style={{ fontWeight: 600, color: "#0F172A" }}>
              {effectiveMode === "std" ? "corporate rate" : "mid-market rate"}
            </span>
            {rate !== null && (
              <>
                {" · "}
                <span className="tabular-nums" style={{ fontWeight: 600, color: "#0F172A" }}>{rateDisplay}</span>
              </>
            )}
            {effectiveMode === "mid" && midRecord && (
              <>
                {" · "}Auto-synced from {API_PROVIDER}
                {" · "}Last updated {fmtTimestamp(midRecord.effectiveDate)}
              </>
            )}
            {effectiveMode === "std" && stdRecord && (
              <>
                {" · "}Manually set by {stdRecord.createdBy}
                {" on "}{fmtTimestamp(stdRecord.updatedAt || stdRecord.effectiveDate)}
              </>
            )}
          </span>
          {isSwapped && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] cursor-help"
                  style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                  tabIndex={0}
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  Inverse rate
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">
                {RATE_TOOLTIPS.inverse}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

/** Segmented Mid-market / Corporate selector with per-side info tooltips. */
function RateSegmentedToggle({
  mode,
  onChange,
  corporateAvailable,
  compact = false,
}: {
  mode: "mid" | "std";
  onChange: (m: "mid" | "std") => void;
  corporateAvailable: boolean;
  compact?: boolean;
}) {
  const segBase = `inline-flex items-center gap-1 transition-colors cursor-pointer ${
    compact ? "h-7 px-2.5 text-[11.5px]" : "h-8 px-3 text-[12px]"
  }`;
  const active = "bg-white text-[#0F172A] shadow-sm";
  const inactive = "text-[#64748B] hover:text-[#0F172A]";
  return (
    <div
      className={`inline-flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-0.5 shrink-0`}
      role="tablist"
      aria-label="Rate type"
    >
      <button
        type="button"
        onClick={() => onChange("mid")}
        className={`${segBase} rounded-md ${mode === "mid" ? active : inactive}`}
        style={{ fontWeight: mode === "mid" ? 600 : 500 }}
        role="tab"
        aria-selected={mode === "mid"}
      >
        Mid-market rate
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              tabIndex={-1}
              onClick={e => e.stopPropagation()}
            >
              <Info className="w-3 h-3 text-[#94A3B8]" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11.5px]">
            {CONVERTER_TOGGLE_TOOLTIPS.midMarket}
          </TooltipContent>
        </Tooltip>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange("std")}
            disabled={!corporateAvailable}
            className={`${segBase} rounded-md ${mode === "std" && corporateAvailable ? active : inactive} ${!corporateAvailable ? "opacity-60 cursor-not-allowed" : ""}`}
            style={{ fontWeight: mode === "std" ? 600 : 500 }}
            role="tab"
            aria-selected={mode === "std"}
          >
            Corporate rate
            <Info className="w-3 h-3 text-[#94A3B8]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11.5px]">
          {corporateAvailable
            ? CONVERTER_TOGGLE_TOOLTIPS.corporate
            : "No corporate rate is defined for this pair."}
        </TooltipContent>
      </Tooltip>
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

  const allDocTabsRaw: DocSection[] = [
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

  // Per-tab totals — surfaced inline under each tab label so the page no
  // longer needs the five separate summary cards.
  const allDocTabs = allDocTabsRaw.map(t => ({
    ...t,
    totalAmount: t.data.reduce((s, d) => s + parseAmount(d.amount), 0),
  }));


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

      {/* STICKY HEADER — title row + always-visible compact converter */}
      <div className="shrink-0 sticky top-[44px] z-20 bg-[#F8FAFC]">
        <div style={{ paddingTop: isScrolled ? "8px" : "12px", paddingBottom: "4px", transition: "padding-top 250ms ease" }}>
          <div className="mx-auto px-4 lg:px-6 xl:px-8 max-w-[1440px] 2xl:max-w-[1600px]">
            <div className={`bg-white border border-[#E2E8F0] rounded-xl transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}>
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
                <div className="text-[12px] text-[#64748B] inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                  <span>Total value across all documents:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" tabIndex={-1}>
                        <Info className="w-3 h-3 text-[#94A3B8] cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-[11.5px]">
                      {RATE_TOOLTIPS.totalValueAllDocs}
                    </TooltipContent>
                  </Tooltip>
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
            </div>

            <div className="border-b border-[#E2E8F0] px-5">
              <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {allDocTabs.map((tab) => {
                  const isActive = activeDocTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveDocTab(tab.key)}
                      className={`relative px-3 py-2 text-left whitespace-nowrap transition-colors cursor-pointer ${
                        isActive ? "text-[#0A77FF]" : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                      style={{ fontWeight: isActive ? 600 : 500 }}
                    >
                      <span className="flex items-center gap-1.5 text-[13px] leading-tight">
                        {tab.label}
                        <span
                          className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] tabular-nums"
                          style={{
                            fontWeight: 600,
                            backgroundColor: isActive ? "#EDF4FF" : "#F1F5F9",
                            color: isActive ? "#0A77FF" : "#94A3B8",
                          }}
                        >
                          {tab.data.length}
                        </span>
                      </span>
                      <span
                        className="block text-[11px] mt-1 leading-tight tabular-nums"
                        style={{ color: isActive ? "rgba(10,119,255,0.75)" : "#94A3B8", fontWeight: 500 }}
                      >
                        {currency.symbol}
                        {fmtMoney(tab.totalAmount)}
                      </span>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0A77FF] rounded-full" />
                      )}
                    </button>
                  );
                })}
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
