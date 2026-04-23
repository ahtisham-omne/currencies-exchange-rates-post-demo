import * as React from "react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Lock, Info } from "lucide-react";
import { toast } from "sonner";
import { CurrencyFlag } from "../ui/CurrencyFlag";
import {
  BASE_CURRENCY,
  CURRENCY_LIBRARY,
  convertBetween,
  getLibraryCurrency,
} from "@/app/data/currencyLibrary";
import type { PurchaseOrderData } from "../poStore";
import {
  getPOVendorCurrency,
  getPOSettlementCurrency,
  updatePOVendorAmountCurrency,
  updatePOSettlementConfig,
} from "../poStore";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrderData;
}

/**
 * PO-level currency override modal ("Currency Configuration"). Three sections:
 *
 *  1. Vendor Amount — the currency the vendor invoices in for this PO. Can
 *     only be changed while the PO has no line items (data-model rule: we
 *     never retroactively re-convert previously-locked item prices).
 *  2. You Pay — the settlement currency. Defaults to the vendor's invoice
 *     currency but the user can settle in a different currency. A live
 *     conversion preview shows the equivalent in the selected currency.
 *     Frozen at save time — downstream (invoices/payments) consumes the
 *     snapshot rather than re-converting.
 *  3. PKR Equivalent — read-only internal reporting number. Recomputes live
 *     as the other fields change.
 *
 * Once the PO is sent to the vendor (status !== "Draft"), the whole modal
 * becomes read-only.
 */
export default function POCurrencyConfigModal({ open, onOpenChange, po }: Props) {
  const readOnly = po.status !== "Draft";
  const hasLineItems = po.lineItems.length > 0;
  const vendorAmountDisabled = readOnly || hasLineItems;

  const [vendorCurrency, setVendorCurrency] = useState<string>(getPOVendorCurrency(po));
  const [settlementCurrency, setSettlementCurrency] = useState<string>(getPOSettlementCurrency(po));

  // Reset local state when the modal re-opens for a fresh PO snapshot.
  React.useEffect(() => {
    if (open) {
      setVendorCurrency(getPOVendorCurrency(po));
      setSettlementCurrency(getPOSettlementCurrency(po));
    }
  }, [open, po]);

  // Live PKR equivalent (always uses current market rate). Total is already
  // in PKR on the PO — if there are no line items, fall back to 0.
  const totalPKR = po.total ?? 0;

  const settlementPreview = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return totalPKR;
    return convertBetween(totalPKR, BASE_CURRENCY, settlementCurrency);
  }, [totalPKR, settlementCurrency]);

  const settlementRateAtSave = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return 1;
    const toSettlement = convertBetween(1, BASE_CURRENCY, settlementCurrency);
    return toSettlement; // units of settlementCurrency per 1 PKR
  }, [settlementCurrency]);

  const handleSave = () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }
    // Only attempt vendor-amount change when allowed (no line items yet).
    if (!hasLineItems && vendorCurrency !== getPOVendorCurrency(po)) {
      updatePOVendorAmountCurrency(po.id, vendorCurrency);
    }
    // Always allowed: capture settlement config snapshot.
    updatePOSettlementConfig(po.id, settlementCurrency, settlementPreview, settlementRateAtSave);
    toast.success("Currency configuration saved", { description: "This PO will settle in " + settlementCurrency });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-[15px]" style={{ fontWeight: 700 }}>Currency Configuration</DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            This configuration applies only to this PO. The vendor's default currency stays the same.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-[11.5px] text-slate-600">
            <Lock className="w-3.5 h-3.5 mt-[2px] shrink-0 text-slate-500" />
            <span>This PO has been sent to the vendor. Currency configuration is read-only.</span>
          </div>
        )}

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* ── 1. Vendor Amount ─────────────────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <Label className="text-[12.5px]" style={{ fontWeight: 600 }}>
              Vendor Amount
            </Label>
            <CurrencySelect
              value={vendorCurrency}
              onChange={setVendorCurrency}
              disabled={vendorAmountDisabled}
            />
            <p className="text-[11px] text-slate-500 leading-snug">
              Change this if the vendor invoices in a different currency for this PO.
              {hasLineItems && !readOnly && (
                <span className="block mt-1 text-amber-700">
                  Remove all items to change the invoice currency.
                </span>
              )}
            </p>
          </section>

          {/* ── 2. You Pay ───────────────────────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <Label className="text-[12.5px]" style={{ fontWeight: 600 }}>
              You Pay
            </Label>
            <CurrencySelect
              value={settlementCurrency}
              onChange={setSettlementCurrency}
              disabled={readOnly}
            />
            <p className="text-[11px] text-slate-500 leading-snug">
              Change this if you settle in a different currency.
            </p>
            {/* Live conversion preview */}
            <PreviewLine label="Settlement amount" currency={settlementCurrency} value={settlementPreview} />
          </section>

          {/* ── 3. PKR Equivalent (read-only) ────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <Label className="text-[12.5px] text-slate-500" style={{ fontWeight: 600 }}>
              PKR Equivalent
            </Label>
            <div
              className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-[13px] text-slate-700 tabular-nums flex items-center gap-2"
              style={{ fontWeight: 500 }}
            >
              <CurrencyFlag currency={getLibraryCurrency(BASE_CURRENCY)!} size={16} />
              <span>{formatCurrency(totalPKR, BASE_CURRENCY)} {BASE_CURRENCY}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug flex items-center gap-1">
              <Info className="w-3 h-3" />
              For internal reporting · Locked at PO creation rate
            </p>
          </section>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={readOnly}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrencySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        {CURRENCY_LIBRARY.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-[13px]">
            <span className="inline-flex items-center gap-2">
              <CurrencyFlag currency={c} size={14} />
              <span style={{ fontWeight: 600 }}>{c.code}</span>
              <span className="text-slate-500">— {c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PreviewLine({ label, currency, value }: { label: string; currency: string; value: number }) {
  const cur = getLibraryCurrency(currency);
  const symbol = cur?.symbol ?? currency;
  return (
    <div className="mt-1 px-3 py-2 rounded-md bg-blue-50 border border-blue-100 text-[12px] text-blue-900 tabular-nums flex items-center justify-between">
      <span className="text-blue-700">{label}</span>
      <span style={{ fontWeight: 600 }}>
        {cur && <CurrencyFlag currency={cur} size={14} />}{" "}
        {symbol} {formatCurrency(value, currency)} {currency.toUpperCase()}
      </span>
    </div>
  );
}

function formatCurrency(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
