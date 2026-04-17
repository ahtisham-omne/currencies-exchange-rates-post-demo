import React, { useState } from "react";
import { ExpandableTextarea } from "./ExpandableTextarea";
import {
  Plus, X, CreditCard, ChevronLeft, Check, Pencil, Trash2, Star, Archive,
  ArrowUpDown, ExternalLink, ChevronDown, MoreHorizontal, Eye, EyeOff,
  Building2, Hash, Phone, MapPin, FileText, Percent, AlertCircle, Wallet, User, Search,
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { FilterPills, type FilterPillOption } from "./FilterPills";
import {
  type PaymentMethodType,
  type PaymentTypeCategory,
  type PaymentMethodEntry,
  PAYMENT_TYPE_CARDS,
} from "./partnerConstants";
import { createEmptyPaymentEntry } from "./config-helpers";

const inputCls = "mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20";

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
function formatAccountNumber(v: string, fmt: CountryBankFormat = DEFAULT_FORMAT): string {
  const digits = v.replace(/\D/g, "").slice(0, fmt.accountMaxDigits);
  return fmt.accountFormat(digits);
}
function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}
function formatCVV(v: string): string {
  return v.replace(/\D/g, "").slice(0, 4);
}
function formatPhone(v: string, fmt: CountryBankFormat = DEFAULT_FORMAT): string {
  const digits = v.replace(/\D/g, "").slice(0, fmt.phoneDigits);
  return fmt.phoneFormat(digits);
}

const catColor: Record<string, string> = {
  Bank: "#0A77FF",
  Traditional: "#7C3AED",
  Card: "#D97706",
  Digital: "#059669",
  Other: "#64748B",
};
const catBg: Record<string, string> = {
  Bank: "#EDF4FF",
  Traditional: "#F0EBFF",
  Card: "#FEF3C7",
  Digital: "#ECFDF5",
  Other: "#F1F5F9",
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
      <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Phone Number</Label>
      <div className="flex gap-0 mt-1.5">
        <Popover open={phoneCountryOpen} onOpenChange={setPhoneCountryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 h-10 border border-r-0 rounded-l-lg bg-white text-sm text-[#0F172A] shrink-0 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                phoneCountryOpen ? "border-[#0A77FF] bg-[#F8FAFC]" : "border-[#E2E8F0]"
              }`}
            >
              <span className="text-base">{activeFormat.flag}</span>
              <span style={{ fontWeight: 500 }}>{activeFormat.phoneCode}</span>
              <ChevronDown className={`w-3 h-3 text-[#94A3B8] transition-transform ${phoneCountryOpen ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0 rounded-xl border border-[#E2E8F0] shadow-lg z-[300]" align="start" sideOffset={4}>
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                <input
                  value={phoneSearch}
                  onChange={(ev) => setPhoneSearch(ev.target.value)}
                  placeholder="Search country..."
                  className="w-full h-8 pl-8 pr-3 rounded-md border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF]"
                  autoFocus
                />
              </div>
            </div>
            <div className="border-t border-[#F1F5F9]" style={{ maxHeight: 200, overflowY: "auto" }}>
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F8FAFC] ${isActive ? "bg-[#EDF4FF]/50" : ""}`}
                  >
                    <span className="text-base shrink-0">{c.flag}</span>
                    <span className="text-[12px] text-[#0F172A] flex-1" style={{ fontWeight: 500 }}>{c.country}</span>
                    <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>{c.phoneCode}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-[#0A77FF] shrink-0" />}
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
          className="rounded-l-none rounded-r-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
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
}: {
  e: PaymentMethodEntry;
  updateEntry: (id: string, updates: Partial<PaymentMethodEntry>) => void;
  countryFormat?: CountryBankFormat;
}) {
  const fmt = countryFormat || DEFAULT_FORMAT;
  return (
    <>
      {/* Nickname */}
      <div>
        <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Nickname</Label>
        <Input value={e.nickname} onChange={(ev) => updateEntry(e.id, { nickname: ev.target.value })} placeholder="e.g. Primary ACH, Backup Wire" className={inputCls} />
      </div>

      {/* ACH / Direct Deposit */}
      {e.type === "ach" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Bank Name <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.bankName} onChange={(ev) => updateEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Title <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.accountTitle} onChange={(ev) => updateEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Number <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.accountNumber} onChange={(ev) => updateEntry(e.id, { accountNumber: formatAccountNumber(ev.target.value, fmt) })} placeholder={fmt.accountPlaceholder} className={inputCls} inputMode="numeric" />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>{fmt.routingLabel} <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.routingNumber} onChange={(ev) => updateEntry(e.id, { routingNumber: formatRoutingNumber(ev.target.value, fmt) })} placeholder={fmt.routingPlaceholder} className={inputCls} inputMode={fmt.routingPlaceholder.match(/[A-Z]/) ? "text" : "numeric"} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Type</Label>
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
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Bank Name <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.bankName} onChange={(ev) => updateEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Title <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.accountTitle} onChange={(ev) => updateEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Number <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.accountNumber} onChange={(ev) => updateEntry(e.id, { accountNumber: formatAccountNumber(ev.target.value, fmt) })} placeholder={fmt.accountPlaceholder} className={inputCls} inputMode="numeric" />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>{fmt.routingLabel} <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.routingNumber} onChange={(ev) => updateEntry(e.id, { routingNumber: formatRoutingNumber(ev.target.value, fmt) })} placeholder={fmt.routingPlaceholder} className={inputCls} inputMode={fmt.routingPlaceholder.match(/[A-Z]/) ? "text" : "numeric"} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>{fmt.swiftLabel} <span className="text-[10px] text-[#94A3B8] font-normal">(optional — international wire only)</span></Label>
            <Input value={e.swiftCode} onChange={(ev) => updateEntry(e.id, { swiftCode: ev.target.value.toUpperCase() })} placeholder="e.g. CHASUS33" className={inputCls} />
          </div>
        </>
      )}

      {/* Credit/Debit Card */}
      {e.type === "card" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Cardholder Name <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.cardholderName} onChange={(ev) => updateEntry(e.id, { cardholderName: ev.target.value })} placeholder="Enter cardholder name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Card Number <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.cardNumber} onChange={(ev) => updateEntry(e.id, { cardNumber: formatCardNumber(ev.target.value) })} placeholder="0000 0000 0000 0000" className={inputCls} inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Expiry Date <span className="text-[#EF4444]">*</span></Label>
              <Input value={e.expiryDate} onChange={(ev) => updateEntry(e.id, { expiryDate: formatExpiry(ev.target.value) })} placeholder="MM/YY" className={inputCls} inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>CVV <span className="text-[#EF4444]">*</span></Label>
              <Input value={e.cvv} onChange={(ev) => updateEntry(e.id, { cvv: formatCVV(ev.target.value) })} placeholder="000" className={inputCls} inputMode="numeric" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Billing Address</Label>
            <Input value={e.billingAddress} onChange={(ev) => updateEntry(e.id, { billingAddress: ev.target.value })} placeholder="Enter billing address" className={inputCls} />
          </div>
        </>
      )}

      {/* Digital Wallet */}
      {e.type === "digital_wallet" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Wallet Provider <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.walletProvider} onChange={(ev) => updateEntry(e.id, { walletProvider: ev.target.value })} placeholder="e.g. PayPal, Venmo, Stripe" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Wallet ID / Email <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.walletId} onChange={(ev) => updateEntry(e.id, { walletId: ev.target.value })} placeholder="Enter wallet ID or email" className={inputCls} />
          </div>
        </>
      )}

      {/* Check (Paper) */}
      {e.type === "check" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Payee Name <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.payeeName} onChange={(ev) => updateEntry(e.id, { payeeName: ev.target.value })} placeholder="Enter payee name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Mailing Address <span className="text-[#EF4444]">*</span></Label>
            <Input value={e.mailingAddress} onChange={(ev) => updateEntry(e.id, { mailingAddress: ev.target.value })} placeholder="Enter mailing address" className={inputCls} />
          </div>
        </>
      )}

      {/* Cash */}
      {e.type === "cash" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Recipient Name</Label>
            <Input value={e.recipientName} onChange={(ev) => updateEntry(e.id, { recipientName: ev.target.value })} placeholder="Enter recipient name" className={inputCls} />
          </div>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Collection Point</Label>
            <Input value={e.collectionPoint} onChange={(ev) => updateEntry(e.id, { collectionPoint: ev.target.value })} placeholder="Enter collection point or location" className={inputCls} />
          </div>
        </>
      )}

      {/* Other (Record Only) */}
      {e.type === "other" && (
        <>
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Method Name</Label>
            <Input value={e.methodName} onChange={(ev) => updateEntry(e.id, { methodName: ev.target.value })} placeholder="e.g. Barter, Trade Credit" className={inputCls} />
          </div>
          <ExpandableTextarea
            label="Description"
            value={e.description}
            onChange={(val) => updateEntry(e.id, { description: val })}
            placeholder="Describe this payment arrangement..."
          />
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Document Attachment Link</Label>
            <Input value={e.documentLink} onChange={(ev) => updateEntry(e.id, { documentLink: ev.target.value })} placeholder="Paste link to supporting document" className={inputCls} />
          </div>
        </>
      )}

      {/* Phone — for ACH, Wire, Digital Wallet, Cash */}
      {(e.type === "ach" || e.type === "wire" || e.type === "digital_wallet" || e.type === "cash") && (
        <PhoneFieldWithCountry e={e} updateEntry={updateEntry} defaultFormat={fmt} />
      )}

      {/* Special Instructions — skip for "other" since it has description */}
      {e.type !== "other" && (
        <div>
          <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Special Instructions</Label>
          <Input value={e.specialInstructions} onChange={(ev) => updateEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className={inputCls} />
        </div>
      )}

      {/* Discount */}
      <div className="pt-1 border-t border-[#E2E8F0]">
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none pt-3 group/disc"
          onClick={() => updateEntry(e.id, { applyDiscount: !e.applyDiscount })}
        >
          <div
            className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
              e.applyDiscount ? "bg-[#0A77FF]" : "border-[1.5px] border-[#CBD5E1] bg-white group-hover/disc:border-[#94A3B8]"
            }`}
          >
            {e.applyDiscount && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
          <span className="text-xs text-[#334155]" style={{ fontWeight: 500 }}>Apply Discount Terms or Additional Charges</span>
        </div>
      </div>
      {e.applyDiscount && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Discount</Label>
              <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                <button
                  type="button"
                  onClick={() => updateEntry(e.id, { discountMode: "percent" })}
                  className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.discountMode ?? "percent") === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                  style={{ fontWeight: 600 }}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => updateEntry(e.id, { discountMode: "fixed" })}
                  className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.discountMode ?? "percent") === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                  style={{ fontWeight: 600 }}
                >
                  $
                </button>
              </div>
            </div>
            <div className="relative mt-1.5">
              {(e.discountMode ?? "percent") === "fixed" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
              )}
              <Input value={e.discountPercent} onChange={(ev) => updateEntry(e.id, { discountPercent: ev.target.value })} placeholder={`e.g. ${(e.discountMode ?? "percent") === "percent" ? "5" : "25.00"}`} className={`rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 ${(e.discountMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
              {(e.discountMode ?? "percent") === "percent" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Add. Charges</Label>
              <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                <button
                  type="button"
                  onClick={() => updateEntry(e.id, { additionalChargesMode: "percent" })}
                  className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.additionalChargesMode ?? "percent") === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                  style={{ fontWeight: 600 }}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => updateEntry(e.id, { additionalChargesMode: "fixed" })}
                  className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.additionalChargesMode ?? "percent") === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                  style={{ fontWeight: 600 }}
                >
                  $
                </button>
              </div>
            </div>
            <div className="relative mt-1.5">
              {(e.additionalChargesMode ?? "percent") === "fixed" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
              )}
              <Input value={e.additionalCharges} onChange={(ev) => updateEntry(e.id, { additionalCharges: ev.target.value })} placeholder={`e.g. ${(e.additionalChargesMode ?? "percent") === "percent" ? "2" : "50.00"}`} className={`rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 ${(e.additionalChargesMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
              {(e.additionalChargesMode ?? "percent") === "percent" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Mask sensitive value: •••• 1234 ──
function maskValue(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

// ── Inline Data Row ──
function DataRow({ icon: Icon, label, value, sensitive = false }: { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return null;
  const displayed = sensitive && !revealed ? maskValue(value) : value;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>{label}</span>
      <span className="text-[10px] text-foreground truncate flex-1 text-right tabular-nums" style={{ fontWeight: 500, letterSpacing: sensitive ? "0.5px" : undefined }}>{displayed}</span>
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
    rows.push({ icon: Hash, label: "Acct #", value: e.accountNumber, sensitive: true });
    rows.push({ icon: Hash, label: "Routing", value: e.routingNumber, sensitive: true });
    if (e.type === "ach" && e.accountType) rows.push({ icon: FileText, label: "Type", value: { checking: "Checking", savings: "Savings", money_market: "Money Market", cd: "Certificate of Deposit", loan: "Loan" }[e.accountType] || e.accountType });
    if (e.type === "wire" && e.swiftCode) rows.push({ icon: Hash, label: "SWIFT", value: e.swiftCode, sensitive: true });
  }
  if (e.type === "card") {
    rows.push({ icon: User, label: "Holder", value: e.cardholderName });
    rows.push({ icon: CreditCard, label: "Card #", value: e.cardNumber, sensitive: true });
    rows.push({ icon: FileText, label: "Expiry", value: e.expiryDate });
    rows.push({ icon: Hash, label: "CVV", value: e.cvv, sensitive: true });
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
  if (e.specialInstructions) rows.push({ icon: AlertCircle, label: "Notes", value: e.specialInstructions });
  
  return rows;
}

// ── Payment Method Card (exported for reuse in details page) ──
export function PaymentMethodCard({
  entry: pe,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  entry: PaymentMethodEntry;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const PeIcon = typeIcon(pe.type);
  const cat = typeCategory(pe.type);
  const color = catColor[cat] || "#64748B";
  const bg = catBg[cat] || "#F1F5F9";
  const dataRows = getEntryDataRows(pe);

  return (
    <div
      onClick={onEdit}
      className={`bg-white rounded-xl group transition-all duration-200 flex flex-col relative cursor-pointer ${
        pe.isPrimary
          ? "border-[1.5px] border-[#0A77FF]/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)] hover:shadow-[0_4px_20px_-4px_rgba(10,119,255,0.18)]"
          : "border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
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
              <p className="text-xs text-[#0F172A] truncate leading-tight" style={{ fontWeight: 600 }}>{getEntrySummary(pe)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-[1px] rounded-full" style={{ fontWeight: 600, color, backgroundColor: bg }}>
                  {typeLabel(pe.type)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {pe.isPrimary ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>
                <Star className="w-2.5 h-2.5 fill-white" /> Primary
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onSetPrimary} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#E2E8F0] bg-white text-[10px] text-[#94A3B8] hover:text-[#0A77FF] hover:border-[#0A77FF]/30 hover:bg-[#EDF4FF] transition-all cursor-pointer opacity-0 group-hover:opacity-100" style={{ fontWeight: 600 }}>
                    <Star className="w-2.5 h-2.5" /> Primary
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[300]"><p className="text-xs">Set as primary</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onDelete} className="p-1 rounded-md hover:bg-[#FEF2F2] transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                  <Archive className="w-3 h-3 text-[#94A3B8] hover:text-[#DC2626]" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="z-[300]"><p className="text-xs">Archive</p></TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Data rows */}
        {dataRows.length > 0 && (
          <div className="flex flex-col gap-[5px] py-1.5 px-2 rounded-lg bg-[#FAFBFC] border border-[#F1F5F9]">
            {dataRows.map((row, i) => (
              <DataRow key={i} icon={row.icon} label={row.label} value={row.value} sensitive={row.sensitive} />
            ))}
          </div>
        )}

        {/* Discount/charges strip */}
        {pe.applyDiscount && (
          <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#FAFBFC] border border-[#F1F5F9]">
            <div className="flex items-center gap-1">
              <Percent className="w-2.5 h-2.5 text-[#0A77FF]" />
              <span className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Discount</span>
            </div>
            <span className="text-[10px] text-[#0F172A] tabular-nums" style={{ fontWeight: 600 }}>{(pe.discountMode ?? "percent") === "fixed" ? "$" : ""}{pe.discountPercent || "0"}{(pe.discountMode ?? "percent") === "percent" ? "%" : ""}</span>
            {pe.additionalCharges && (
              <>
                <span className="text-[10px] text-[#CBD5E1] mx-1">|</span>
                <span className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Charges</span>
                <span className="text-[10px] text-[#0F172A] tabular-nums ml-1" style={{ fontWeight: 600 }}>{(pe.additionalChargesMode ?? "percent") === "fixed" ? "$" : ""}{pe.additionalCharges}{(pe.additionalChargesMode ?? "percent") === "percent" ? "%" : ""}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#F1F5F9] bg-[#FAFBFC] rounded-b-xl">
        <span className="text-[9px] text-[#94A3B8]" style={{ fontWeight: 500 }}>{typeCategory(pe.type)}</span>
        <span
          className="px-1.5 py-[1px] rounded-full text-[9px] border"
          style={{ fontWeight: 500, color: "#059669", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
        >
          Active
        </span>
      </div>
    </div>
  );
}


export function PaymentMethodsSection({
  configType,
  paymentEntries,
  setPaymentEntries,
  savedPaymentEntries,
  updatePaymentEntry,
  savePaymentEntry,
  removePaymentEntry,
  country,
}: {
  configType: "vendor" | "customer";
  paymentEntries: PaymentMethodEntry[];
  setPaymentEntries: React.Dispatch<React.SetStateAction<PaymentMethodEntry[]>>;
  savedPaymentEntries: PaymentMethodEntry[];
  updatePaymentEntry: (id: string, updates: Partial<PaymentMethodEntry>) => void;
  savePaymentEntry: (id: string) => void;
  removePaymentEntry: (id: string) => void;
  country?: string;
}) {
  const countryFormat = getCountryFormat(country);
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [pmModalStep, setPmModalStep] = useState<"select" | "form">("select");
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

  function selectTypeAndProceed(type: PaymentMethodType) {
    const newEntry = createEmptyPaymentEntry(type);
    setPaymentEntries((prev) => [...prev, newEntry]);
    setPmEditingEntryId(newEntry.id);
    setPmModalStep("form");
  }

  function openEditModal(id: string) {
    setPmEditingEntryId(id);
    setPmModalStep("form");
    setPmModalOpen(true);
  }

  function handleModalSave() {
    if (pmEditingEntryId) savePaymentEntry(pmEditingEntryId);
    setPmModalOpen(false);
    setPmEditingEntryId(null);
  }

  function handleModalCancel() {
    if (pmEditingEntryId) {
      const entry = paymentEntries.find((e) => e.id === pmEditingEntryId);
      if (entry && !entry.isSaved) {
        setPaymentEntries((prev) => prev.filter((e) => e.id !== pmEditingEntryId));
      }
    }
    setPmModalOpen(false);
    setPmEditingEntryId(null);
  }

  function handleSetPrimary(id: string) {
    setPaymentEntries((prev) => prev.map((e) => ({ ...e, isPrimary: e.id === id })));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Payment Methods</h4>
        <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
          Configure payment methods for this {configType}. Add multiple methods across bank transfers, cards, digital wallets and more.{" "}
          <span className="text-[#0A77FF] inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
            Learn More <ExternalLink className="w-3 h-3" />
          </span>
        </p>
      </div>

      {/* Toolbar */}
      {savedPaymentEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1">
            <FilterPills
              options={[
                { key: "all", label: "All", count: savedPaymentEntries.length, showCount: true },
                ...savedTypes.map((st) => ({
                  key: st,
                  label: typeLabel(st),
                  count: savedPaymentEntries.filter((e) => e.type === st).length,
                  showCount: true,
                })),
              ]}
              activeKey={pmListFilter}
              onSelect={(k) => setPmListFilter(k as PaymentMethodType | "all")}
            />
          </div>
          <Select value={pmListSort} onValueChange={(v: "newest" | "oldest" | "type" | "name") => setPmListSort(v)}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-[11px] rounded-lg border-border bg-background px-2 gap-1 [&>svg]:w-3 [&>svg]:h-3">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[250] rounded-lg text-[11px]">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="type">By Type</SelectItem>
              <SelectItem value="name">By Name</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={openAddModal}
            className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] hover:bg-primary/90 transition-colors inline-flex items-center gap-1 cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-3 h-3" /> Add Method
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
              onEdit={() => openEditModal(pe.id)}
              onDelete={() => removePaymentEntry(pe.id)}
              onSetPrimary={() => handleSetPrimary(pe.id)}
            />
          ))}
        </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#FAFBFC] py-10 px-4 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[#EDF4FF] border border-[#DBEAFE] flex items-center justify-center mb-3">
            <CreditCard className="w-6 h-6 text-[#0A77FF]" />
          </div>
          <p className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>No payment methods added yet</p>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-[280px]">
            Add payment methods to define how this {configType} sends or receives payments. You can configure multiple methods.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2.5 rounded-lg bg-[#0A77FF] text-white text-xs hover:bg-[#0862D0] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
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
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[250] !border-[#E2E8F0]/60"
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
                    className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#64748B]" />
                  </button>
                )}
                {pmModalStep === "form" && modalEntry ? (() => {
                  const Icon = typeIcon(modalEntry.type);
                  const cat = typeCategory(modalEntry.type);
                  return (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catBg[cat] || "#F1F5F9" }}>
                        <Icon className="w-4 h-4" style={{ color: catColor[cat] || "#64748B" }} />
                      </div>
                      <div>
                        <h3 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>
                          {modalEntry.isSaved ? `Edit ${typeLabel(modalEntry.type)}` : `New ${typeLabel(modalEntry.type)}`}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, color: catColor[cat] || "#64748B", backgroundColor: catBg[cat] || "#F1F5F9" }}>
                          {typeCategory(modalEntry.type)}
                        </span>
                      </div>
                    </div>
                  );
                })() : (
                  <div>
                    <h3 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Add Payment Method</h3>
                    {pmModalStep === "select" && <p className="text-[11px] text-[#94A3B8] mt-0.5">Choose a payment method type to get started</p>}
                  </div>
                )}
              </div>
              <button onClick={handleModalCancel} className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                <X className="w-4 h-4 text-[#64748B]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-white scrollbar-hide">
              {pmModalStep === "select" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredTypeCards.map((t) => {
                      const Icon = t.icon;
                      const color = catColor[t.category] || "#64748B";
                      const bg = catBg[t.category] || "#F1F5F9";
                      return (
                        <button
                          key={t.id}
                          onClick={() => selectTypeAndProceed(t.id)}
                          className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E8ECF1] bg-white text-left hover:border-[#BFDBFE] hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.08)] transition-all group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: bg }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-[#0F172A] group-hover:text-[#0A77FF] transition-colors" style={{ fontWeight: 600 }}>{t.label}</p>
                            <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-relaxed">{t.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : modalEntry ? (
                <div className="space-y-3">
                  <PaymentFormFields e={modalEntry} updateEntry={updatePaymentEntry} countryFormat={countryFormat} />
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {pmModalStep === "form" && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
                <button onClick={handleModalCancel} className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={handleModalSave} className="px-4 py-2 rounded-lg bg-[#0A77FF] text-white text-xs hover:bg-[#0960D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                  {modalEntry?.isSaved ? "Update Method" : "Save Method"}
                </button>
              </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
