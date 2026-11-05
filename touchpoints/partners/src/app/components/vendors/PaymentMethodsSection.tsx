import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { ExpandableTextarea } from "./ExpandableTextarea";
import {
  Plus, X, CreditCard, ChevronLeft, Check, Pencil, Trash2, Star,
  ArrowUpDown, ExternalLink, ChevronDown, Eye, EyeOff,
  Building2, Hash, Phone, MapPin, FileText, Wallet, User, Search, AlertCircle,
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { InfoTooltip } from "../ui/info-tooltip";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { PrimaryPill } from "./PrimaryPill";
import { PctAmountToggle } from "./PctAmountToggle";
import { FilterPills, type FilterPillOption } from "./FilterPills";
import {
  type PaymentMethodType,
  type PaymentTypeCategory,
  type PaymentMethodEntry,
  PAYMENT_TYPE_CARDS,
} from "./partnerConstants";
import { createEmptyPaymentEntry, containsSensitiveNumber } from "./config-helpers";

const inputCls = "mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20";

// A free-text field (Wallet ID, "Other" Description) is blocked from saving while it
// holds something that looks like a card or account number — per the payment-methods
// classification (free-text fields must never carry sensitive numbers).
function entryFreeTextBlocked(e: PaymentMethodEntry | null | undefined): boolean {
  if (!e) return false;
  if (e.type === "digital_wallet" && containsSensitiveNumber(e.walletId)) return true;
  if (e.type === "other") return containsSensitiveNumber(e.description);
  return containsSensitiveNumber(e.specialInstructions);
}

// Discount / Additional Charges are optional, but a non-empty value must be
// a valid non-negative number, and percent-mode values can't exceed 100%.
// Returns the inline error copy, or null when the field is valid/empty.
function discountFieldError(raw: string | undefined, mode: "percent" | "fixed"): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return "Enter a valid number";
  if (n < 0) return "Value can't be negative";
  if (mode === "percent" && n > 100) return "Can't exceed 100%";
  return null;
}

// Save gate — blocks Save/Update while either discount field holds an
// invalid value (only relevant when the discount toggle is on).
function entryDiscountInvalid(e: PaymentMethodEntry | null | undefined): boolean {
  if (!e?.applyDiscount) return false;
  return (
    !!discountFieldError(e.discountPercent, (e.discountMode ?? "percent") as "percent" | "fixed") ||
    !!discountFieldError(e.additionalCharges, (e.additionalChargesMode ?? "percent") as "percent" | "fixed")
  );
}

// ── Country banking format definitions ──
interface CountryBankFormat {
  code: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: (d: string) => string;
  phonePlaceholder: string;
  accountMaxDigits: number;
  accountFormat: (d: string) => string;
  accountPlaceholder: string;
  routingLabel: string;
  routingMaxDigits: number;
  routingFormat: (d: string) => string;
  routingPlaceholder: string;
  hasRouting: boolean;
  swiftLabel: string;
}

const COUNTRY_BANK_FORMATS: Record<string, CountryBankFormat> = {
  USA: {
    code: "US", flag: "🇺🇸", phoneCode: "+1", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 6) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; if (d.length > 3) return `(${d.slice(0,3)}) ${d.slice(3)}`; return d; },
    phonePlaceholder: "(555) 123-4567",
    accountMaxDigits: 17, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "0000 0000 0000 0",
    routingLabel: "Routing Number (ABA)", routingMaxDigits: 9, routingFormat: (d) => d, routingPlaceholder: "021000021", hasRouting: true, swiftLabel: "SWIFT / BIC Code",
  },
  UK: {
    code: "GB", flag: "🇬🇧", phoneCode: "+44", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 4) return `${d.slice(0,4)} ${d.slice(4)}`; return d; },
    phonePlaceholder: "7911 123456",
    accountMaxDigits: 8, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "0000 0000",
    routingLabel: "Sort Code", routingMaxDigits: 6, routingFormat: (d) => { if (d.length > 4) return `${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4)}`; if (d.length > 2) return `${d.slice(0,2)}-${d.slice(2)}`; return d; }, routingPlaceholder: "20-00-00", hasRouting: true, swiftLabel: "SWIFT / BIC Code",
  },
  Germany: {
    code: "DE", flag: "🇩🇪", phoneCode: "+49", phoneDigits: 11,
    phoneFormat: (d) => { if (d.length > 4) return `${d.slice(0,3)} ${d.slice(3)}`; return d; },
    phonePlaceholder: "151 12345678",
    accountMaxDigits: 22, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "DE89 3704 0044 0532 0130 00",
    routingLabel: "BLZ (Bank Code)", routingMaxDigits: 8, routingFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), routingPlaceholder: "3704 0044", hasRouting: true, swiftLabel: "SWIFT / BIC Code",
  },
  Japan: {
    code: "JP", flag: "🇯🇵", phoneCode: "+81", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 6) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`; if (d.length > 2) return `${d.slice(0,2)}-${d.slice(2)}`; return d; },
    phonePlaceholder: "90-1234-5678",
    accountMaxDigits: 7, accountFormat: (d) => d, accountPlaceholder: "1234567",
    routingLabel: "Bank & Branch Code", routingMaxDigits: 7, routingFormat: (d) => { if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`; return d; }, routingPlaceholder: "001-0123", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  India: {
    code: "IN", flag: "🇮🇳", phoneCode: "+91", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 5) return `${d.slice(0,5)} ${d.slice(5)}`; return d; },
    phonePlaceholder: "98765 43210",
    accountMaxDigits: 18, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "0000 0000 0000 0000 00",
    routingLabel: "IFSC Code", routingMaxDigits: 11, routingFormat: (d) => d.toUpperCase(), routingPlaceholder: "SBIN0001234", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  China: {
    code: "CN", flag: "🇨🇳", phoneCode: "+86", phoneDigits: 11,
    phoneFormat: (d) => { if (d.length > 7) return `${d.slice(0,3)} ${d.slice(3,7)} ${d.slice(7)}`; if (d.length > 3) return `${d.slice(0,3)} ${d.slice(3)}`; return d; },
    phonePlaceholder: "138 0013 8000",
    accountMaxDigits: 19, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "6222 0000 0000 0000 000",
    routingLabel: "CNAPS Code", routingMaxDigits: 12, routingFormat: (d) => d, routingPlaceholder: "102100099996", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  UAE: {
    code: "AE", flag: "🇦🇪", phoneCode: "+971", phoneDigits: 9,
    phoneFormat: (d) => { if (d.length > 2) return `${d.slice(0,2)} ${d.slice(2)}`; return d; },
    phonePlaceholder: "50 123 4567",
    accountMaxDigits: 23, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "AE07 0331 2345 6789 0123 456",
    routingLabel: "Bank Code", routingMaxDigits: 4, routingFormat: (d) => d, routingPlaceholder: "0331", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  "South Korea": {
    code: "KR", flag: "🇰🇷", phoneCode: "+82", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 6) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`; if (d.length > 2) return `${d.slice(0,2)}-${d.slice(2)}`; return d; },
    phonePlaceholder: "10-1234-5678",
    accountMaxDigits: 14, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1-"), accountPlaceholder: "1234-5678-9012-34",
    routingLabel: "Bank Code", routingMaxDigits: 3, routingFormat: (d) => d, routingPlaceholder: "004", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  Australia: {
    code: "AU", flag: "🇦🇺", phoneCode: "+61", phoneDigits: 9,
    phoneFormat: (d) => { if (d.length > 5) return `${d.slice(0,1)} ${d.slice(1,5)} ${d.slice(5)}`; if (d.length > 1) return `${d.slice(0,1)} ${d.slice(1)}`; return d; },
    phonePlaceholder: "4 1234 5678",
    accountMaxDigits: 9, accountFormat: (d) => d, accountPlaceholder: "123456789",
    routingLabel: "BSB Number", routingMaxDigits: 6, routingFormat: (d) => { if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`; return d; }, routingPlaceholder: "062-000", hasRouting: true, swiftLabel: "SWIFT Code",
  },
  Canada: {
    code: "CA", flag: "🇨🇦", phoneCode: "+1", phoneDigits: 10,
    phoneFormat: (d) => { if (d.length > 6) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; if (d.length > 3) return `(${d.slice(0,3)}) ${d.slice(3)}`; return d; },
    phonePlaceholder: "(416) 123-4567",
    accountMaxDigits: 12, accountFormat: (d) => d.replace(/(\d{4})(?=\d)/g, "$1 "), accountPlaceholder: "0000 0000 0000",
    routingLabel: "Transit + Institution", routingMaxDigits: 8, routingFormat: (d) => { if (d.length > 5) return `${d.slice(0,5)}-${d.slice(5)}`; return d; }, routingPlaceholder: "00002-004", hasRouting: true, swiftLabel: "SWIFT Code",
  },
};

export const DEFAULT_FORMAT: CountryBankFormat = COUNTRY_BANK_FORMATS["USA"];

// Map partner group country to format
export function getCountryFormat(country?: string): CountryBankFormat {
  if (!country) return DEFAULT_FORMAT;
  return COUNTRY_BANK_FORMATS[country] || DEFAULT_FORMAT;
}

// ── Auto-format helpers (country-aware) ──
function formatRoutingNumber(v: string, fmt: CountryBankFormat = DEFAULT_FORMAT): string {
  const clean = fmt.routingPlaceholder.match(/[A-Z]/) ? v.replace(/[^a-zA-Z0-9]/g, "").slice(0, fmt.routingMaxDigits) : v.replace(/\D/g, "").slice(0, fmt.routingMaxDigits);
  return fmt.routingFormat(clean);
}
// Account Number & Card Number are "store last-N only" fields (PCI Req 3.5.1 / NACHA
// §1.6): the full number is never collected this release — only the last 4 digits are
// captured. So entry is capped at 4 numeric digits. (fmt kept for call-site stability.)
function formatAccountNumber(v: string, _fmt: CountryBankFormat = DEFAULT_FORMAT): string {
  return v.replace(/\D/g, "").slice(0, 4);
}
function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 4);
}
function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}
function formatPhone(v: string, fmt: CountryBankFormat = DEFAULT_FORMAT): string {
  const digits = v.replace(/\D/g, "").slice(0, fmt.phoneDigits);
  return fmt.phoneFormat(digits);
}

const catColor: Record<string, string> = {
  Bank: "rgb(var(--primary))",
  Traditional: "rgb(var(--violet))",
  Card: "rgb(var(--warning))",
  Digital: "rgb(var(--success))",
  Other: "#64748B",
};
const catBg: Record<string, string> = {
  Bank: "rgb(var(--accent))",
  Traditional: "#F0EBFF",
  Card: "#FEF3C7",
  Digital: "#ECFDF5",
  Other: "rgb(var(--muted))",
};

const categories: PaymentTypeCategory[] = ["Bank", "Card", "Digital", "Traditional", "Other"];

function typeLabel(type: PaymentMethodType) {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.label || type;
}
function typeIcon(type: PaymentMethodType) {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.icon || CreditCard;
}
function typeCategory(type: PaymentMethodType): string {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.category || "Other";
}

// ── Group-level Payment Methods: type-only selector ──
// At the partner-group level we only template WHICH payment method types
// apply to the group's partners — never the account details (account
// numbers, routing, card numbers live on each individual partner, since
// every partner carries its own). So the group surface is a multi-select
// of payment types rather than the full add-with-details flow.
export function GroupPaymentTypeSelect({
  selectedTypes,
  onToggle,
  configType,
}: {
  selectedTypes: PaymentMethodType[];
  onToggle: (type: PaymentMethodType) => void;
  configType: "vendor" | "customer";
}) {
  const audience = configType === "customer" ? "customers" : "partners";
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Payment Methods</h4>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed max-w-[440px]">
            Choose which payment method types apply to {audience} in this group. Each partner enters their own account details (account numbers, routing, cards) on their own record.
          </p>
        </div>
        <span className="text-[11px] text-slate-400 shrink-0 mt-0.5" style={{ fontWeight: 500 }}>
          {selectedTypes.length} selected
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PAYMENT_TYPE_CARDS.map((t) => {
          const Icon = t.icon;
          const selected = selectedTypes.includes(t.id);
          const color = catColor[t.category] || "#64748B";
          const bg = catBg[t.category] || "rgb(var(--muted))";
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer ${
                selected
                  ? "border-primary bg-blue-50/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.15)]"
                  : "border-border bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground leading-tight" style={{ fontWeight: 600 }}>{t.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.description}</p>
                </div>
                <div
                  className={`w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    selected ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white"
                  }`}
                >
                  {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getEntrySummary(e: PaymentMethodEntry): string {
  if (e.nickname) return e.nickname;
  if (e.bankName) return e.bankName;
  if (e.cardholderName) return e.cardholderName;
  if (e.walletProvider) return e.walletProvider;
  if (e.payeeName) return e.payeeName;
  if (e.recipientName) return e.recipientName;
  if (e.methodName) return e.methodName;
  return typeLabel(e.type);
}

function getEntrySubtext(e: PaymentMethodEntry): string {
  if (e.accountNumber) return `••••${e.accountNumber.slice(-4)}`;
  if (e.cardNumber) return `••••${e.cardNumber.slice(-4)}`;
  if (e.walletId) return e.walletId;
  if (e.mailingAddress) return e.mailingAddress;
  if (e.collectionPoint) return e.collectionPoint;
  if (e.description) return e.description;
  return typeCategory(e.type);
}

// ── Phone country list for selector ──
const PHONE_COUNTRIES = Object.entries(COUNTRY_BANK_FORMATS).map(([country, f]) => ({
  country,
  code: f.code,
  flag: f.flag,
  phoneCode: f.phoneCode,
}));

// ── Phone field with country selector ──
export function PhoneFieldWithCountry({ e, updateEntry, defaultFormat }: {
  e: PaymentMethodEntry;
  updateEntry: (id: string, updates: Partial<PaymentMethodEntry>) => void;
  defaultFormat: CountryBankFormat;
}) {
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  // Determine active format from stored countryCode
  const activeFormat = Object.values(COUNTRY_BANK_FORMATS).find(f => f.phoneCode === e.countryCode) || defaultFormat;

  const filtered = phoneSearch.trim()
    ? PHONE_COUNTRIES.filter(c => c.country.toLowerCase().includes(phoneSearch.toLowerCase()) || c.phoneCode.includes(phoneSearch))
    : PHONE_COUNTRIES;

  return (
    <div>
      <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Phone Number</Label>
      <div className="flex gap-0 mt-1.5">
        <Popover open={phoneCountryOpen} onOpenChange={setPhoneCountryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 h-10 border border-r-0 rounded-l-lg bg-white text-sm text-foreground shrink-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                phoneCountryOpen ? "border-primary bg-slate-50" : "border-border"
              }`}
            >
              <span className="text-base">{activeFormat.flag}</span>
              <span style={{ fontWeight: 500 }}>{activeFormat.phoneCode}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${phoneCountryOpen ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0 rounded-xl border border-border shadow-lg z-[300]" align="start" sideOffset={4}>
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={phoneSearch}
                  onChange={(ev) => setPhoneSearch(ev.target.value)}
                  placeholder="Search country..."
                  className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            </div>
            <div className="border-t border-muted" style={{ maxHeight: 200, overflowY: "auto" }}>
              {filtered.map((c) => {
                const isActive = activeFormat.phoneCode === c.phoneCode;
                return (
                  <button
                    key={c.country}
                    type="button"
                    onClick={() => {
                      const newFmt = COUNTRY_BANK_FORMATS[c.country];
                      updateEntry(e.id, { countryCode: c.phoneCode, phone: formatPhone(e.phone.replace(/\D/g, ""), newFmt) });
                      setPhoneCountryOpen(false);
                      setPhoneSearch("");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${isActive ? "bg-accent/50" : ""}`}
                  >
                    <span className="text-base shrink-0">{c.flag}</span>
                    <span className="text-[12px] text-foreground flex-1" style={{ fontWeight: 500 }}>{c.country}</span>
                    <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{c.phoneCode}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={e.phone}
          onChange={(ev) => updateEntry(e.id, { phone: formatPhone(ev.target.value, activeFormat), countryCode: activeFormat.phoneCode })}
          placeholder={activeFormat.phonePlaceholder}
          inputMode="numeric"
          className="rounded-l-none rounded-r-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}

// ── Form Fields Renderer ──
function PaymentFormFields({
  e,
  updateEntry,
  countryFormat,
  readOnly = false,
}: {
  e: PaymentMethodEntry;
  updateEntry: (id: string, updates: Partial<PaymentMethodEntry>) => void;
  countryFormat?: CountryBankFormat;
  /** View-only mode — native controls are disabled via the
   *  wrapping fieldset; the discount toggle guards its own click. */
  readOnly?: boolean;
}) {
  const fmt = countryFormat || DEFAULT_FORMAT;
  const [walletIdBlocked, setWalletIdBlocked] = useState(false);
  const descError = e.type === "other" && containsSensitiveNumber(e.description)
    ? "Remove the card or account number, this is a free-text record only."
    : "";
  const specialInstructionsError = e.type !== "other" && containsSensitiveNumber(e.specialInstructions)
    ? "Remove the card or account number, this is a free-text field only."
    : "";
  return (
    <fieldset disabled={readOnly} className="space-y-3 w-full min-w-0 border-0 p-0 m-0">
      {/* Nickname */}
      <div>
        <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Nickname</Label>
        <Input value={e.nickname} onChange={(ev) => updateEntry(e.id, { nickname: ev.target.value })} placeholder="e.g. Primary ACH, Backup Wire" className={inputCls} />
      </div>

      {/* ACH / Direct Deposit */}
      {e.type === "ach" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Bank Name <span className="text-red-500">*</span></Label>
            <Input value={e.bankName} onChange={(ev) => updateEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Account Title <span className="text-red-500">*</span></Label>
            <Input value={e.accountTitle} onChange={(ev) => updateEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
              <span>Account Number (Last 4) <span className="text-red-500">*</span></span>
              <InfoTooltip>Enter only the last 4 digits. For security, the full account number is never collected or stored this release.</InfoTooltip>
            </Label>
            <Input value={e.accountNumber} onChange={(ev) => updateEntry(e.id, { accountNumber: formatAccountNumber(ev.target.value, fmt) })} placeholder="1234" className={inputCls} inputMode="numeric" maxLength={4} />
          </div>
          <div>
            {/* Always the plain "Routing Number" label — country formats keep
                driving the mask/placeholder, but the label stays consistent. */}
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Routing Number <span className="text-red-500">*</span></Label>
            <Input value={e.routingNumber} onChange={(ev) => updateEntry(e.id, { routingNumber: formatRoutingNumber(ev.target.value, fmt) })} placeholder={fmt.routingPlaceholder} className={inputCls} inputMode={fmt.routingPlaceholder.match(/[A-Z]/) ? "text" : "numeric"} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Account Type</Label>
            <Select value={e.accountType} onValueChange={(v) => updateEntry(e.id, { accountType: v })}>
              <SelectTrigger className={`${inputCls} mt-1.5`}>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent className="z-[250] rounded-lg">
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="money_market">Money Market</SelectItem>
                <SelectItem value="cd">Certificate of Deposit (CD)</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Wire Transfer */}
      {e.type === "wire" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Bank Name <span className="text-red-500">*</span></Label>
            <Input value={e.bankName} onChange={(ev) => updateEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Account Title <span className="text-red-500">*</span></Label>
            <Input value={e.accountTitle} onChange={(ev) => updateEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
              <span>Account Number (Last 4) <span className="text-red-500">*</span></span>
              <InfoTooltip>Enter only the last 4 digits. For security, the full account number is never collected or stored this release.</InfoTooltip>
            </Label>
            <Input value={e.accountNumber} onChange={(ev) => updateEntry(e.id, { accountNumber: formatAccountNumber(ev.target.value, fmt) })} placeholder="1234" className={inputCls} inputMode="numeric" maxLength={4} />
          </div>
          <div>
            {/* Always the plain "Routing Number" label — country formats keep
                driving the mask/placeholder, but the label stays consistent. */}
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Routing Number <span className="text-red-500">*</span></Label>
            <Input value={e.routingNumber} onChange={(ev) => updateEntry(e.id, { routingNumber: formatRoutingNumber(ev.target.value, fmt) })} placeholder={fmt.routingPlaceholder} className={inputCls} inputMode={fmt.routingPlaceholder.match(/[A-Z]/) ? "text" : "numeric"} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>{fmt.swiftLabel} <span className="text-[10px] text-slate-400 font-normal">(optional, international wire only)</span></Label>
            <Input value={e.swiftCode} onChange={(ev) => updateEntry(e.id, { swiftCode: ev.target.value.toUpperCase() })} placeholder="e.g. CHASUS33" className={inputCls} />
          </div>
        </>
      )}

      {/* Credit/Debit Card */}
      {e.type === "card" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Cardholder Name <span className="text-red-500">*</span></Label>
            <Input value={e.cardholderName} onChange={(ev) => updateEntry(e.id, { cardholderName: ev.target.value })} placeholder="Enter cardholder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
              <span>Card Number (Last 4) <span className="text-red-500">*</span></span>
              <InfoTooltip>Enter only the last 4 digits. For security, the full card number is never collected or stored this release.</InfoTooltip>
            </Label>
            <Input value={e.cardNumber} onChange={(ev) => updateEntry(e.id, { cardNumber: formatCardNumber(ev.target.value) })} placeholder="1234" className={inputCls} inputMode="numeric" maxLength={4} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Expiry Date <span className="text-red-500">*</span></Label>
            <Input value={e.expiryDate} onChange={(ev) => updateEntry(e.id, { expiryDate: formatExpiry(ev.target.value) })} placeholder="MM/YY" className={inputCls} inputMode="numeric" />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Billing Address</Label>
            <Input value={e.billingAddress} onChange={(ev) => updateEntry(e.id, { billingAddress: ev.target.value })} placeholder="Enter billing address" className={inputCls} />
          </div>
        </>
      )}

      {/* Digital Wallet */}
      {e.type === "digital_wallet" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Wallet Provider <span className="text-red-500">*</span></Label>
            <Input value={e.walletProvider} onChange={(ev) => updateEntry(e.id, { walletProvider: ev.target.value })} placeholder="e.g. PayPal, Venmo, Stripe" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
              <span>Wallet ID / Email <span className="text-red-500">*</span></span>
              <InfoTooltip>Enter a wallet handle, email, or token, never a raw card number.</InfoTooltip>
            </Label>
            <Input
              value={e.walletId}
              onChange={(ev) => {
                const v = ev.target.value;
                if (containsSensitiveNumber(v)) { setWalletIdBlocked(true); return; }
                setWalletIdBlocked(false);
                updateEntry(e.id, { walletId: v });
              }}
              placeholder="Enter wallet ID or email"
              className={inputCls}
            />
            {walletIdBlocked && (
              <p className="mt-1 text-[11px] text-red-500" style={{ fontWeight: 500 }}>This looks like a card or account number. Use a wallet handle, email, or token instead.</p>
            )}
          </div>
        </>
      )}

      {/* Check (Paper) */}
      {e.type === "check" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Payee Name <span className="text-red-500">*</span></Label>
            <Input value={e.payeeName} onChange={(ev) => updateEntry(e.id, { payeeName: ev.target.value })} placeholder="Enter payee name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Mailing Address</Label>
            <Input value={e.mailingAddress} onChange={(ev) => updateEntry(e.id, { mailingAddress: ev.target.value })} placeholder="Enter mailing address" className={inputCls} />
          </div>
        </>
      )}

      {/* Cash */}
      {e.type === "cash" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Recipient Name</Label>
            <Input value={e.recipientName} onChange={(ev) => updateEntry(e.id, { recipientName: ev.target.value })} placeholder="Enter recipient name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Collection Point</Label>
            <Input value={e.collectionPoint} onChange={(ev) => updateEntry(e.id, { collectionPoint: ev.target.value })} placeholder="Enter collection point or location" className={inputCls} />
          </div>
        </>
      )}

      {/* Other (Record Only) */}
      {e.type === "other" && (
        <>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Method Name</Label>
            <Input value={e.methodName} onChange={(ev) => updateEntry(e.id, { methodName: ev.target.value })} placeholder="e.g. Barter, Trade Credit" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
              <span>Description</span>
              <InfoTooltip>Record-only notes. Don't paste card or bank account numbers here.</InfoTooltip>
            </Label>
            <div className="mt-1.5">
              <ExpandableTextarea
                value={e.description}
                onChange={(val) => updateEntry(e.id, { description: val })}
                placeholder="Describe this payment arrangement..."
                error={descError}
              />
            </div>
          </div>
        </>
      )}

      {/* Phone — for ACH, Wire, Digital Wallet, Cash */}
      {(e.type === "ach" || e.type === "wire" || e.type === "digital_wallet" || e.type === "cash") && (
        <PhoneFieldWithCountry e={e} updateEntry={updateEntry} defaultFormat={fmt} />
      )}

      {/* Special Instructions — skip for "other" since it has description.
          Free-text, so it's guarded: a value that looks like a card or account
          number flags an inline error and blocks Save (classification rule #3). */}
      {e.type !== "other" && (
        <div>
          <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
            <span>Special Instructions</span>
            <InfoTooltip>Free-text notes. Don't paste card or bank account numbers here.</InfoTooltip>
          </Label>
          <Input value={e.specialInstructions} onChange={(ev) => updateEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className={inputCls} />
          {specialInstructionsError && (
            <p className="mt-1 text-[11px] text-red-500" style={{ fontWeight: 500 }}>{specialInstructionsError}</p>
          )}
        </div>
      )}

      {/* Discount */}
      <div className="pt-1 border-t border-border">
        <div
          className={`flex items-center gap-2.5 select-none pt-3 group/disc ${readOnly ? "pointer-events-none" : "cursor-pointer"}`}
          onClick={() => { if (!readOnly) updateEntry(e.id, { applyDiscount: !e.applyDiscount }); }}
        >
          <div
            className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
              e.applyDiscount ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white group-hover/disc:border-slate-400"
            }`}
          >
            {e.applyDiscount && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
          <span className="text-xs text-slate-700" style={{ fontWeight: 500 }}>Apply Discount Terms or Additional Charges</span>
        </div>
      </div>
      {e.applyDiscount && (() => {
        const discountErr = discountFieldError(e.discountPercent, (e.discountMode ?? "percent") as "percent" | "fixed");
        const chargesErr = discountFieldError(e.additionalCharges, (e.additionalChargesMode ?? "percent") as "percent" | "fixed");
        return (
        <div className={`grid grid-cols-2 gap-3 ${readOnly ? "pointer-events-none" : ""}`}>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Discount</Label>
              <PctAmountToggle
                isFixed={(e.discountMode ?? "percent") === "fixed"}
                onChange={(fixed) => updateEntry(e.id, { discountMode: fixed ? "fixed" : "percent" })}
                percentTooltip="Discount applied as a percentage of the transaction amount."
                amountTooltip="Discount applied as a fixed dollar amount."
              />
            </div>
            <div className="relative mt-1.5">
              {(e.discountMode ?? "percent") === "fixed" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              )}
              <Input value={e.discountPercent} onChange={(ev) => updateEntry(e.id, { discountPercent: ev.target.value })} aria-invalid={!!discountErr} placeholder={`e.g. ${(e.discountMode ?? "percent") === "percent" ? "5" : "25.00"}`} className={`rounded-lg !h-10 bg-white text-sm text-foreground placeholder:text-slate-300 ${discountErr ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive/20" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"} ${(e.discountMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
              {(e.discountMode ?? "percent") === "percent" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              )}
            </div>
            {discountErr && (
              <p className="mt-1 text-[10px] text-destructive" style={{ fontWeight: 500 }}>{discountErr}</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Add. Charges</Label>
              <PctAmountToggle
                isFixed={(e.additionalChargesMode ?? "percent") === "fixed"}
                onChange={(fixed) => updateEntry(e.id, { additionalChargesMode: fixed ? "fixed" : "percent" })}
                percentTooltip="Additional charges added as a percentage of the transaction amount."
                amountTooltip="Additional charges added as a fixed dollar amount."
              />
            </div>
            <div className="relative mt-1.5">
              {(e.additionalChargesMode ?? "percent") === "fixed" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              )}
              <Input value={e.additionalCharges} onChange={(ev) => updateEntry(e.id, { additionalCharges: ev.target.value })} aria-invalid={!!chargesErr} placeholder={`e.g. ${(e.additionalChargesMode ?? "percent") === "percent" ? "2" : "50.00"}`} className={`rounded-lg !h-10 bg-white text-sm text-foreground placeholder:text-slate-300 ${chargesErr ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive/20" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"} ${(e.additionalChargesMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
              {(e.additionalChargesMode ?? "percent") === "percent" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              )}
            </div>
            {chargesErr && (
              <p className="mt-1 text-[10px] text-destructive" style={{ fontWeight: 500 }}>{chargesErr}</p>
            )}
          </div>
        </div>
        );
      })()}
    </fieldset>
  );
}

// ── Mask sensitive value: •••• 1234 ──
function maskValue(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

// ── "Store last-N only" display: always •••• 1234, never revealable ──
// Card Number and Account Number retain only the last 4 (classification rule #1),
// so they are shown truncated with no reveal toggle — the full number is never held.
function lastFourDisplay(value: string): string {
  const clean = (value || "").replace(/\s/g, "");
  return clean ? `•••• ${clean.slice(-4)}` : "";
}

// ── Inline Data Row ──
function DataRow({ icon: Icon, label, value, sensitive = false }: { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  // Values get at most 50% of the card row; anything longer truncates on
  // the right and surfaces the full text in a hover tooltip (same approach
  // as the description tooltips elsewhere in the system). Overflow is
  // measured on the rendered span so short values never grow a tooltip.
  const valueRef = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);
  const displayed = value ? (sensitive && !revealed ? maskValue(value) : value) : "";
  useEffect(() => {
    const el = valueRef.current;
    if (el) setOverflowed(el.scrollWidth > el.clientWidth + 1);
  }, [displayed]);
  if (!value) return null;
  const valueSpan = (
    <span
      ref={valueRef}
      className="text-[10px] text-foreground truncate text-right max-w-[50%] ml-auto"
      style={{ fontWeight: 500, letterSpacing: sensitive ? "0.5px" : undefined }}
    >
      {displayed}
    </span>
  );
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>{label}</span>
      {overflowed ? (
        <Tooltip>
          <TooltipTrigger asChild>{valueSpan}</TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-[280px] z-[300]">
            <p className="text-xs break-words">{displayed}</p>
          </TooltipContent>
        </Tooltip>
      ) : valueSpan}
      {sensitive && (
        <button
          onClick={(ev) => { ev.stopPropagation(); setRevealed(!revealed); }}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer shrink-0"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff className="w-2.5 h-2.5 text-muted-foreground" /> : <Eye className="w-2.5 h-2.5 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}

// ── Get all displayable fields for an entry ──
function getEntryDataRows(e: PaymentMethodEntry): { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }[] {
  const rows: { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }[] = [];
  
  // Common: nickname shown as title, so skip
  if (e.type === "ach" || e.type === "wire") {
    rows.push({ icon: Building2, label: "Bank", value: e.bankName });
    rows.push({ icon: User, label: "Account", value: e.accountTitle });
    rows.push({ icon: Hash, label: "Acct #", value: lastFourDisplay(e.accountNumber) });
    // Routing numbers are public bank identifiers, not sensitive — shown
    // plain with no mask/eye toggle.
    rows.push({ icon: Hash, label: "Routing", value: e.routingNumber });
    if (e.type === "ach" && e.accountType) rows.push({ icon: FileText, label: "Type", value: { checking: "Checking", savings: "Savings", money_market: "Money Market", cd: "Certificate of Deposit", loan: "Loan" }[e.accountType] || e.accountType });
    if (e.type === "wire" && e.swiftCode) rows.push({ icon: Hash, label: "SWIFT", value: e.swiftCode, sensitive: true });
  }
  if (e.type === "card") {
    rows.push({ icon: User, label: "Holder", value: e.cardholderName });
    rows.push({ icon: CreditCard, label: "Card #", value: lastFourDisplay(e.cardNumber) });
    rows.push({ icon: FileText, label: "Expiry", value: e.expiryDate });
    if (e.billingAddress) rows.push({ icon: MapPin, label: "Billing", value: e.billingAddress });
  }
  if (e.type === "digital_wallet") {
    rows.push({ icon: Wallet, label: "Provider", value: e.walletProvider });
    rows.push({ icon: Hash, label: "Wallet ID", value: e.walletId, sensitive: true });
  }
  if (e.type === "check") {
    rows.push({ icon: User, label: "Payee", value: e.payeeName });
    rows.push({ icon: MapPin, label: "Address", value: e.mailingAddress });
  }
  if (e.type === "cash") {
    rows.push({ icon: User, label: "Recipient", value: e.recipientName });
    rows.push({ icon: MapPin, label: "Location", value: e.collectionPoint });
  }
  if (e.type === "other") {
    rows.push({ icon: FileText, label: "Method", value: e.methodName });
    if (e.description) rows.push({ icon: FileText, label: "Desc", value: e.description });
  }
  // Common fields
  if (e.phone) rows.push({ icon: Phone, label: "Phone", value: `${e.countryCode} ${e.phone}` });
  if (e.type !== "other" && e.specialInstructions) rows.push({ icon: AlertCircle, label: "Notes", value: e.specialInstructions });

  return rows;
}

// ── Payment Method Card (exported for reuse in details page) ──
export function PaymentMethodCard({
  entry: pe,
  onView,
  onEdit,
  onSetPrimary,
}: {
  entry: PaymentMethodEntry;
  /** Whole-card click opens the read-only view modal. */
  onView: () => void;
  /** Top-right Edit (pencil) action button — jumps straight into
   *  edit mode. Remove lives inside the view modal's header. */
  onEdit: () => void;
  onSetPrimary: () => void;
}) {
  const PeIcon = typeIcon(pe.type);
  const cat = typeCategory(pe.type);
  const color = catColor[cat] || "#64748B";
  const bg = catBg[cat] || "rgb(var(--muted))";
  const dataRows = getEntryDataRows(pe);

  return (
    <div
      onClick={onView}
      className={`bg-white rounded-xl group transition-all duration-200 flex flex-col relative cursor-pointer ${
        pe.isPrimary
          ? "border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)] hover:shadow-[0_4px_20px_-4px_rgba(10,119,255,0.18)]"
          : "border border-border hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Header: icon + name + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <PeIcon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate leading-tight" style={{ fontWeight: 600 }}>{getEntrySummary(pe)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-[1px] rounded-full" style={{ fontWeight: 600, color, backgroundColor: bg }}>
                  {typeLabel(pe.type)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {pe.isPrimary ? (
              <PrimaryPill />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSetPrimary}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                    title="Set as primary"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Set as primary</p></TooltipContent>
              </Tooltip>
            )}
            {/* Edit — jumps straight into edit mode. Card body
                click opens the read-only view; Remove lives in the
                view modal's header. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="z-[300]"><p className="text-xs">Edit</p></TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Data rows */}
        {dataRows.length > 0 && (
          <div className="flex flex-col gap-[5px] py-1.5 px-2 rounded-lg bg-[#FAFBFC] border border-muted">
            {dataRows.map((row, i) => (
              <DataRow key={i} icon={row.icon} label={row.label} value={row.value} sensitive={row.sensitive} />
            ))}
          </div>
        )}

        {/* Discount/charges strip — only shown when the user actually
            entered a value in at least one field ("0" counts as entered;
            checkbox-only with both fields blank renders nothing). When
            shown, BOTH cells render so the pair always reads together;
            the untouched field shows a dash. */}
        {(() => {
          const hasDiscountVal = (pe.discountPercent ?? "").trim() !== "";
          const hasChargesVal = (pe.additionalCharges ?? "").trim() !== "";
          if (!pe.applyDiscount || (!hasDiscountVal && !hasChargesVal)) return null;
          return (
            <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#FAFBFC] border border-muted">
              <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Discount</span>
              <span className="text-[10px] text-foreground" style={{ fontWeight: 600 }}>
                {hasDiscountVal
                  ? `${(pe.discountMode ?? "percent") === "fixed" ? "$" : ""}${pe.discountPercent}${(pe.discountMode ?? "percent") === "percent" ? "%" : ""}`
                  : "—"}
              </span>
              <span className="text-[10px] text-slate-300 mx-1">|</span>
              <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Charges</span>
              <span className="text-[10px] text-foreground ml-1" style={{ fontWeight: 600 }}>
                {hasChargesVal
                  ? `${(pe.additionalChargesMode ?? "percent") === "fixed" ? "$" : ""}${pe.additionalCharges}${(pe.additionalChargesMode ?? "percent") === "percent" ? "%" : ""}`
                  : "—"}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Footer removed — typeCategory + status pill were
          duplicating info already shown in the header chip + the
          new top-right Active/Inactive pill, matching the F&L
          card pattern. */}
    </div>
  );
}


/** Imperative handle exposed to parents that want to drive the
 *  Add modal from their own toolbar (e.g. partner-detail Payment
 *  Methods tab puts the Add CTA on the sub-tabs row). */
export interface PaymentMethodsSectionHandle {
  openAddModal: () => void;
}

interface PaymentMethodsSectionProps {
  configType: "vendor" | "customer";
  paymentEntries: PaymentMethodEntry[];
  setPaymentEntries: React.Dispatch<React.SetStateAction<PaymentMethodEntry[]>>;
  savedPaymentEntries: PaymentMethodEntry[];
  updatePaymentEntry: (id: string, updates: Partial<PaymentMethodEntry>) => void;
  savePaymentEntry: (id: string) => void;
  removePaymentEntry: (id: string) => void;
  country?: string;
  /** Hide the built-in count + Add CTA toolbar. Use when the
   *  parent surfaces those affordances on its own outer toolbar
   *  (the partner-detail tab does this so the F&L sub-tabs row
   *  stays the single Add button location). */
  hideToolbar?: boolean;
  /** When true (partner-detail Payment Methods tab), edits and
   *  removals go through a confirmation prompt. Left false in the
   *  creation form, where prompting on every add/edit is noise. */
  confirmMutations?: boolean;
}

export const PaymentMethodsSection = forwardRef<PaymentMethodsSectionHandle, PaymentMethodsSectionProps>(function PaymentMethodsSection({
  configType,
  paymentEntries,
  setPaymentEntries,
  savedPaymentEntries,
  updatePaymentEntry,
  savePaymentEntry,
  removePaymentEntry,
  country,
  hideToolbar,
  confirmMutations = false,
}, ref) {
  const countryFormat = getCountryFormat(country);
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [pmModalStep, setPmModalStep] = useState<"select" | "form">("select");
  // Form sub-mode: "view" (read-only) vs "edit" (editable). Only
  // meaningful while pmModalStep === "form".
  const [pmFormMode, setPmFormMode] = useState<"view" | "edit">("edit");
  // Snapshot taken when entering edit on a saved entry, so Cancel
  // can restore the pre-edit values (fields mutate live).
  const editSnapshotRef = React.useRef<PaymentMethodEntry | null>(null);
  // Save-changes confirmation (partner-detail only).
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pmModalTypeFilter, setPmModalTypeFilter] = useState<PaymentTypeCategory | "All">("All");
  const [pmEditingEntryId, setPmEditingEntryId] = useState<string | null>(null);
  const [pmListFilter, setPmListFilter] = useState<PaymentMethodType | "all">("all");
  const [pmListSort, setPmListSort] = useState<"newest" | "oldest" | "type" | "name">("newest");

  const filteredTypeCards = pmModalTypeFilter === "All" ? PAYMENT_TYPE_CARDS : PAYMENT_TYPE_CARDS.filter((t) => t.category === pmModalTypeFilter);
  const modalEntry = paymentEntries.find((e) => e.id === pmEditingEntryId) || null;
  const savedTypes = Array.from(new Set(savedPaymentEntries.map((e) => e.type)));

  const filteredSaved = savedPaymentEntries
    .filter((e) => pmListFilter === "all" || e.type === pmListFilter)
    .sort((a, b) => {
      if (pmListSort === "type") return typeLabel(a.type).localeCompare(typeLabel(b.type));
      if (pmListSort === "name") return getEntrySummary(a).localeCompare(getEntrySummary(b));
      if (pmListSort === "oldest") return a.id.localeCompare(b.id);
      return b.id.localeCompare(a.id);
    });

  function openAddModal() {
    setPmModalStep("select");
    setPmEditingEntryId(null);
    setPmModalTypeFilter("All");
    setPmModalOpen(true);
  }
  useImperativeHandle(ref, () => ({ openAddModal }), []);
  // Remove confirmation state — triggered from the edit form's
  // footer Remove button.
  const [removeId, setRemoveId] = useState<string | null>(null);
  const removeEntry = removeId ? savedPaymentEntries.find((e) => e.id === removeId) || null : null;

  function selectTypeAndProceed(type: PaymentMethodType) {
    const newEntry = createEmptyPaymentEntry(type);
    setPaymentEntries((prev) => [...prev, newEntry]);
    editSnapshotRef.current = null;
    setPmEditingEntryId(newEntry.id);
    setPmFormMode("edit");
    setPmModalStep("form");
  }

  // Card body click → read-only view.
  function openViewModal(id: string) {
    editSnapshotRef.current = null;
    setPmEditingEntryId(id);
    setPmFormMode("view");
    setPmModalStep("form");
    setPmModalOpen(true);
  }

  // Card Edit button + view-modal Edit CTA → editable form. Snapshot
  // the saved entry so Cancel can roll back the live-mutated fields.
  function openEditModal(id: string) {
    const entry = paymentEntries.find((e) => e.id === id);
    editSnapshotRef.current = entry?.isSaved ? { ...entry } : null;
    setPmEditingEntryId(id);
    setPmFormMode("edit");
    setPmModalStep("form");
    setPmModalOpen(true);
  }

  function closeModal() {
    setPmModalOpen(false);
    setPmEditingEntryId(null);
    editSnapshotRef.current = null;
  }

  // Persist the edit and close the modal — both new methods and
  // edits to an existing method dismiss once done.
  function finalizeSave() {
    setSaveConfirmOpen(false);
    if (!pmEditingEntryId) return;
    // A checked discount toggle with BOTH fields left blank carries no
    // information — reset it on save so re-editing the method shows the
    // checkbox unchecked (matches the card, which hides the strip).
    const entry = paymentEntries.find((e) => e.id === pmEditingEntryId);
    if (
      entry?.applyDiscount &&
      (entry.discountPercent ?? "").trim() === "" &&
      (entry.additionalCharges ?? "").trim() === ""
    ) {
      updatePaymentEntry(pmEditingEntryId, { applyDiscount: false });
    }
    savePaymentEntry(pmEditingEntryId);
    closeModal();
  }

  // Save button in edit mode. Prompt only when configured and only
  // for edits to an already-saved method.
  function handleModalSave() {
    const isExisting = Boolean(paymentEntries.find((e) => e.id === pmEditingEntryId)?.isSaved);
    if (confirmMutations && isExisting) {
      setSaveConfirmOpen(true);
      return;
    }
    finalizeSave();
  }

  // Full close (header X, Esc, outside). New (unsaved) entries are
  // discarded; unconfirmed edits to a saved method are rolled back
  // from the snapshot before closing.
  function handleModalCancel() {
    if (pmEditingEntryId) {
      const entry = paymentEntries.find((e) => e.id === pmEditingEntryId);
      if (entry && !entry.isSaved) {
        setPaymentEntries((prev) => prev.filter((e) => e.id !== pmEditingEntryId));
      } else if (pmModalStep === "form" && pmFormMode === "edit" && editSnapshotRef.current) {
        updatePaymentEntry(editSnapshotRef.current.id, editSnapshotRef.current);
      }
    }
    closeModal();
  }

  // Footer Cancel in edit mode. New entries discard + close; edits
  // to a saved method roll back and return to the read-only view.
  function handleEditCancel() {
    if (pmEditingEntryId) {
      const entry = paymentEntries.find((e) => e.id === pmEditingEntryId);
      if (entry && !entry.isSaved) {
        setPaymentEntries((prev) => prev.filter((e) => e.id !== pmEditingEntryId));
        closeModal();
        return;
      }
      if (editSnapshotRef.current) {
        updatePaymentEntry(editSnapshotRef.current.id, editSnapshotRef.current);
        editSnapshotRef.current = null;
      }
      setPmFormMode("view");
      return;
    }
    closeModal();
  }

  function handleSetPrimary(id: string) {
    const existingPrimary = savedPaymentEntries.find((e) => e.isPrimary);
    if (!existingPrimary || existingPrimary.id === id) {
      setPaymentEntries((prev) => prev.map((e) => ({ ...e, isPrimary: e.id === id })));
      return;
    }
    setPrimaryChangeId(id);
  }
  // Primary-change confirmation — opens when the user clicks the
  // star on a non-primary card while another card already holds
  // primary. First-primary path skips the prompt (handled above).
  const [primaryChangeId, setPrimaryChangeId] = useState<string | null>(null);
  const primaryChangeEntry = primaryChangeId ? savedPaymentEntries.find((e) => e.id === primaryChangeId) : null;
  const primaryCurrent = savedPaymentEntries.find((e) => e.isPrimary) || null;

  // F&L-style tint per side — drives the Add CTA accent so the
  // tab + button feel paired (blue for vendor, emerald for
  // customer).
  const tint = configType === "vendor"
    ? { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF", hoverBg: "#CFE6FF" }
    : { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", hoverBg: "#D1FAE5" };

  return (
    <div className="space-y-4">
      {/* Toolbar — count on the left, tinted Add CTA on the right.
          Same shape as the F&L tab toolbar. Hidden in two cases:
          (1) parent already owns the toolbar (hideToolbar prop),
          (2) empty state — the empty-state body already has a
          large Add CTA, so a top one would be redundant. Once at
          least one method is configured, toolbar reappears so
          users can add a second / third without scrolling. */}
      {!hideToolbar && savedPaymentEntries.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span style={{ fontWeight: 600 }}>{savedPaymentEntries.length}</span> payment method{savedPaymentEntries.length !== 1 ? "s" : ""} configured
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: tint.bg, borderColor: tint.border, color: tint.color }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Payment Method
          </button>
        </div>
      )}

      {/* Saved Grid */}
      {savedPaymentEntries.length > 0 ? (
        <div className="@container/pmgrid w-full">
        <div className="grid grid-cols-1 @[400px]/pmgrid:grid-cols-2 @[750px]/pmgrid:grid-cols-3 gap-3">
          {filteredSaved.map((pe) => (
            <PaymentMethodCard
              key={pe.id}
              entry={pe}
              onView={() => openViewModal(pe.id)}
              onEdit={() => openEditModal(pe.id)}
              onSetPrimary={() => handleSetPrimary(pe.id)}
            />
          ))}
        </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border bg-white py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No payment methods added yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
            Add payment methods to define how this {configType} sends or receives payments. You can configure multiple methods.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2.5 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Payment Method
          </button>
        </div>
      )}

      {/* Modal */}
      <Dialog open={pmModalOpen} onOpenChange={(open) => { if (!open) handleModalCancel(); }}>
        <DialogContent
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[250] !border-border/60"
          overlayClassName="!bg-black/20 !z-[250]"
          style={{ maxWidth: 580, width: "calc(100% - 2rem)", maxHeight: "85vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          hideCloseButton
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Add Payment Method</DialogTitle>
          <DialogDescription className="sr-only">Choose a payment method type and fill in the details.</DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8ECF1] bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                {pmModalStep === "form" && !modalEntry?.isSaved && (
                  <button
                    onClick={() => {
                      if (pmEditingEntryId) {
                        const entry = paymentEntries.find((e) => e.id === pmEditingEntryId);
                        if (entry && !entry.isSaved) setPaymentEntries((prev) => prev.filter((e) => e.id !== pmEditingEntryId));
                      }
                      setPmModalStep("select");
                      setPmEditingEntryId(null);
                    }}
                    className="p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                {pmModalStep === "form" && modalEntry ? (() => {
                  const Icon = typeIcon(modalEntry.type);
                  const cat = typeCategory(modalEntry.type);
                  return (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catBg[cat] || "rgb(var(--muted))" }}>
                        <Icon className="w-4 h-4" style={{ color: catColor[cat] || "#64748B" }} />
                      </div>
                      <div>
                        <h3 className="text-sm text-foreground" style={{ fontWeight: 700 }}>
                          {pmFormMode === "view"
                            ? typeLabel(modalEntry.type)
                            : modalEntry.isSaved ? `Edit ${typeLabel(modalEntry.type)}` : `New ${typeLabel(modalEntry.type)}`}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, color: catColor[cat] || "#64748B", backgroundColor: catBg[cat] || "rgb(var(--muted))" }}>
                          {typeCategory(modalEntry.type)}
                        </span>
                      </div>
                    </div>
                  );
                })() : (
                  <div>
                    <h3 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Add Payment Method</h3>
                    {pmModalStep === "select" && <p className="text-[11px] text-slate-400 mt-0.5">Choose a payment method type to get started</p>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* View-mode CTAs — Edit + Remove, mirroring the
                    pricing-rule detail header. Edit jumps into the
                    editable form; Remove prompts on the detail page
                    and removes directly in the creation form. */}
                {pmModalStep === "form" && pmFormMode === "view" && modalEntry?.isSaved && (
                  <>
                    <button
                      onClick={() => { if (modalEntry) openEditModal(modalEntry.id); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!modalEntry) return;
                        if (confirmMutations) {
                          setRemoveId(modalEntry.id);
                        } else {
                          removePaymentEntry(modalEntry.id);
                          closeModal();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </>
                )}
                <button onClick={handleModalCancel} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-white scrollbar-hide">
              {pmModalStep === "select" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredTypeCards.map((t) => {
                      const Icon = t.icon;
                      const color = catColor[t.category] || "#64748B";
                      const bg = catBg[t.category] || "rgb(var(--muted))";
                      return (
                        <button
                          key={t.id}
                          onClick={() => selectTypeAndProceed(t.id)}
                          className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E8ECF1] bg-white text-left hover:border-blue-200 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.08)] transition-all group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: bg }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-foreground group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>{t.label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{t.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : modalEntry ? (
                <div className="space-y-3">
                  <PaymentFormFields e={modalEntry} updateEntry={updatePaymentEntry} countryFormat={countryFormat} readOnly={pmFormMode === "view"} />
                </div>
              ) : null}
            </div>

            {/* Footer — edit mode only. View mode surfaces its
                actions (Edit / Remove) in the header instead. */}
            {pmModalStep === "form" && pmFormMode === "edit" && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
                <button onClick={handleEditCancel} className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                  Cancel
                </button>
                <button
                  onClick={() => { if (!entryFreeTextBlocked(modalEntry) && !entryDiscountInvalid(modalEntry)) handleModalSave(); }}
                  disabled={entryFreeTextBlocked(modalEntry) || entryDiscountInvalid(modalEntry)}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
                  style={{ fontWeight: 600 }}
                >
                  {modalEntry?.isSaved ? "Update Method" : "Save Method"}
                </button>
              </div>
            )}
        </DialogContent>
      </Dialog>

      {/* ── Primary-change confirmation ──
          Same canonical lifecycle modal as F&L: blue gradient
          header, filled Star, CHANGE PRIMARY pill, stacked
          Make Primary / Keep current primary actions. Body
          calls out the displaced method by name. */}
      <AlertDialog open={!!primaryChangeId} onOpenChange={(open) => { if (!open) setPrimaryChangeId(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setPrimaryChangeId(null)}
        >
          {primaryChangeEntry && (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
                  <Star className="w-8 h-8 fill-[#094D9F]" style={{ color: "#094D9F" }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
                  Change Primary {configType === "vendor" ? "Vendor" : "Customer"} Payment Method
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Make {getEntrySummary(primaryChangeEntry)} the primary payment method?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {primaryCurrent && primaryCurrent.id !== primaryChangeEntry.id ? (
                    <>New {configType} transactions will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryChangeEntry)}</span> instead of <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryCurrent)}</span>. Existing records are unaffected. You can switch back any time.</>
                  ) : (
                    <>New {configType} transactions will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryChangeEntry)}</span>. You can switch back any time.</>
                  )}
                </AlertDialogDescription>
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      const id = primaryChangeId!;
                      setPaymentEntries((prev) => prev.map((e) => ({ ...e, isPrimary: e.id === id })));
                      setPrimaryChangeId(null);
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))", color: "#fff" }}
                  >
                    Make Primary
                  </button>
                  <button
                    onClick={() => setPrimaryChangeId(null)}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Keep Current Primary
                  </button>
                </div>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Remove confirmation ── (partner-detail only)
          Opened from the view modal's Remove CTA. On confirm it
          removes the method and closes the modal. */}
      <AlertDialog open={!!removeId} onOpenChange={(open) => { if (!open) setRemoveId(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          overlayClassName="!z-[285]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setRemoveId(null)}
        >
          {removeEntry && (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                  <Trash2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
                  Remove {configType === "vendor" ? "Vendor" : "Customer"} Payment Method
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Remove {getEntrySummary(removeEntry)}?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  The payment method will be removed from this {configType} side. You can re-add it later.
                </AlertDialogDescription>
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (removeId) removePaymentEntry(removeId);
                      setRemoveId(null);
                      // Close the modal too — the method it was
                      // viewing no longer exists.
                      closeModal();
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setRemoveId(null)}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Save-changes confirmation ── (partner-detail only)
          Shown when saving edits to an already-saved method, so
          field changes are confirmed rather than applied silently. */}
      <AlertDialog open={saveConfirmOpen} onOpenChange={(open) => { if (!open) setSaveConfirmOpen(false); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          overlayClassName="!z-[285]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setSaveConfirmOpen(false)}
        >
          {modalEntry && (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
                  <Check className="w-8 h-8" style={{ color: "rgb(var(--primary))" }} strokeWidth={2.5} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
                  Save Changes
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Save changes to {getEntrySummary(modalEntry)}?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  Your edits to this {configType} payment method will be updated.
                </AlertDialogDescription>
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <button
                    onClick={finalizeSave}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))", color: "#fff" }}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setSaveConfirmOpen(false)}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Keep Editing
                  </button>
                </div>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
