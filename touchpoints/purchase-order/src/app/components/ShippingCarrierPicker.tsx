/* ═══════════════════════════════════════════════════════════════
   ShippingCarrierPicker — Two-panel connected dropdown for
   selecting a shipping carrier and method in a single component.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  Truck,
  Package,
  Plane,
  Ship,
  X,
} from "lucide-react";
import { FONT } from "./designTokens";

/* ── Types ── */

export interface ShippingMethod {
  value: string;
  label: string;
  description: string;
  eta: string;
  isDefault?: boolean;
}

export interface ShippingCarrier {
  code: string;
  name: string;
  isDefault?: boolean;
  methods: ShippingMethod[];
}

/* ── Data ── */

export const SHIPPING_CARRIERS_DATA: ShippingCarrier[] = [
  {
    code: "FDX",
    name: "FedEx",
    isDefault: true,
    methods: [
      { value: "fdx-express", label: "FedEx Express", description: "Air", eta: "1-2 days", isDefault: true },
      { value: "fdx-ground", label: "FedEx Ground", description: "Land", eta: "5-7 days" },
      { value: "fdx-freight", label: "FedEx Freight", description: "For larger shipments", eta: "7-14 days" },
      { value: "fdx-intl-priority", label: "FedEx International Priority", description: "Fast international delivery", eta: "1-2 days" },
      { value: "fdx-intl-economy", label: "FedEx International Economy", description: "Cost-effective international", eta: "14-20 days" },
    ],
  },
  {
    code: "TCS",
    name: "TCS (Tranzum Courier Service)",
    methods: [
      { value: "tcs-overnight", label: "TCS Overnight", description: "Air", eta: "1 day" },
      { value: "tcs-overland", label: "TCS Overland", description: "Ground", eta: "3-5 days" },
      { value: "tcs-sameday", label: "TCS Same Day", description: "Express", eta: "Same day" },
      { value: "tcs-logistics", label: "TCS Logistics", description: "Freight", eta: "5-10 days" },
    ],
  },
  {
    code: "DHL",
    name: "DHL Express",
    methods: [
      { value: "dhl-express-ww", label: "DHL Express Worldwide", description: "Air", eta: "1-3 days" },
      { value: "dhl-economy", label: "DHL Economy Select", description: "Ground", eta: "5-8 days" },
      { value: "dhl-freight", label: "DHL Freight", description: "Land/Sea", eta: "7-14 days" },
      { value: "dhl-sameday", label: "DHL Same Day", description: "Express", eta: "Same day" },
      { value: "dhl-ecommerce", label: "DHL eCommerce", description: "Economy", eta: "10-20 days" },
    ],
  },
  {
    code: "UPS",
    name: "UPS (United Parcel Service)",
    methods: [
      { value: "ups-nextday", label: "UPS Next Day Air", description: "Air", eta: "1 day" },
      { value: "ups-2ndday", label: "UPS 2nd Day Air", description: "Air", eta: "2 days" },
      { value: "ups-ground", label: "UPS Ground", description: "Land", eta: "5-7 days" },
      { value: "ups-freight-ltl", label: "UPS Freight LTL", description: "For partial loads", eta: "7-10 days" },
      { value: "ups-worldwide", label: "UPS Worldwide Express", description: "International air", eta: "1-3 days" },
    ],
  },
  {
    code: "MSK",
    name: "Maersk",
    methods: [
      { value: "msk-ocean-fcl", label: "Maersk Ocean FCL", description: "Full container load", eta: "20-40 days" },
      { value: "msk-ocean-lcl", label: "Maersk Ocean LCL", description: "Less than container", eta: "25-45 days" },
      { value: "msk-air", label: "Maersk Air Freight", description: "Air", eta: "3-5 days" },
      { value: "msk-intermodal", label: "Maersk Intermodal", description: "Rail + Truck", eta: "10-18 days" },
    ],
  },
  {
    code: "CHR",
    name: "C.H. Robinson",
    methods: [
      { value: "chr-air-priority", label: "CHR Air Priority", description: "Air express", eta: "1-3 days" },
      { value: "chr-ground-ftl", label: "CHR Ground FTL", description: "Full truckload", eta: "3-5 days" },
      { value: "chr-ground-ltl", label: "CHR Ground LTL", description: "Less than truckload", eta: "5-8 days" },
      { value: "chr-intermodal", label: "CHR Intermodal", description: "Rail + Truck", eta: "8-14 days" },
      { value: "chr-ocean", label: "CHR Ocean", description: "Sea freight", eta: "20-35 days" },
    ],
  },
];

/* ── Helper to find carrier/method by value ── */
export function findCarrierAndMethod(methodValue: string): { carrier: ShippingCarrier | null; method: ShippingMethod | null } {
  for (const carrier of SHIPPING_CARRIERS_DATA) {
    const method = carrier.methods.find((m) => m.value === methodValue);
    if (method) return { carrier, method };
  }
  return { carrier: null, method: null };
}

/* ── Icon for carrier ── */
function CarrierIcon({ code, size = 14 }: { code: string; size?: number }) {
  const style = { width: size, height: size };
  switch (code) {
    case "MSK": return <Ship style={style} />;
    case "FDX": case "UPS": case "DHL": case "TCS": return <Truck style={style} />;
    case "CHR": return <Package style={style} />;
    default: return <Truck style={style} />;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface ShippingCarrierPickerProps {
  selectedMethodValue: string;
  onMethodChange: (methodValue: string) => void;
  disabled?: boolean;
}

export default function ShippingCarrierPicker({
  selectedMethodValue,
  onMethodChange,
  disabled,
}: ShippingCarrierPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCarrierCode, setHoveredCarrierCode] = useState<string | null>(null);
  const [selectedCarrierCode, setSelectedCarrierCode] = useState<string | null>(null);
  const [carrierSearch, setCarrierSearch] = useState("");
  const [methodSearch, setMethodSearch] = useState("");
  const triggerContainerRef = useRef<HTMLDivElement>(null);
  const carrierSearchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const { carrier: currentCarrier, method: currentMethod } = useMemo(
    () => findCarrierAndMethod(selectedMethodValue),
    [selectedMethodValue]
  );

  /* Active carrier for right panel = hovered or clicked */
  const activeCarrierCode = hoveredCarrierCode || selectedCarrierCode || currentCarrier?.code || SHIPPING_CARRIERS_DATA[0].code;
  const activeCarrier = SHIPPING_CARRIERS_DATA.find((c) => c.code === activeCarrierCode) || SHIPPING_CARRIERS_DATA[0];

  /* Filtered carriers */
  const filteredCarriers = useMemo(() => {
    if (!carrierSearch.trim()) return SHIPPING_CARRIERS_DATA;
    const q = carrierSearch.toLowerCase();
    return SHIPPING_CARRIERS_DATA.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [carrierSearch]);

  /* Filtered methods */
  const filteredMethods = useMemo(() => {
    if (!methodSearch.trim()) return activeCarrier.methods;
    const q = methodSearch.toLowerCase();
    return activeCarrier.methods.filter(
      (m) => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    );
  }, [activeCarrier, methodSearch]);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerContainerRef.current && !triggerContainerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  /* Focus search + calculate position on open */
  useEffect(() => {
    if (isOpen) {
      setCarrierSearch("");
      setMethodSearch("");
      setSelectedCarrierCode(currentCarrier?.code || null);
      setHoveredCarrierCode(null);
      if (triggerContainerRef.current) {
        const rect = triggerContainerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const dropdownHeight = 360;
        const openUpward = spaceBelow < dropdownHeight && rect.top > spaceBelow;
        setDropdownPos({
          top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 520),
        });
      }
      setTimeout(() => carrierSearchRef.current?.focus(), 50);
    } else {
      setDropdownPos(null);
    }
  }, [isOpen]);

  const handleSelectMethod = (methodValue: string) => {
    onMethodChange(methodValue);
    setIsOpen(false);
  };

  const displayText = currentCarrier
    ? `${currentCarrier.code} — ${currentCarrier.name.split("(")[0].trim()}`
    : "Select carrier";

  const methodDisplayText = currentMethod
    ? `${currentMethod.label} (${currentMethod.eta})`
    : "Select a method";

  return (
    /* Side-by-side layout — Shipping carrier + Shipping method share
       the same row (2-col grid). Both are the same h-8 field height
       so they align. */
    <div className="grid grid-cols-2 gap-3">
      {/* ── Field 1: Shipping Carrier (interactive) ── */}
      <div className="flex flex-col gap-0.5">
        <label
          className="text-muted-foreground flex items-center gap-1"
          style={{
            fontSize: "10px",
            fontWeight: "var(--font-weight-semibold)",
            lineHeight: "14px",
            fontFamily: FONT,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Shipping Carrier
        </label>

        <div ref={triggerContainerRef} className="relative">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="flex items-center justify-between w-full h-8 px-2.5 rounded-[var(--radius)] border border-border text-left transition-all hover:border-foreground/20 focus:border-primary focus:ring-1 focus:ring-ring/15 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{
              backgroundColor: "hsl(var(--input-background))",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-weight-normal)",
              lineHeight: "18px",
              fontFamily: FONT,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {currentCarrier && (
                <div
                  className="flex items-center justify-center size-5 rounded shrink-0"
                  style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}
                >
                  <CarrierIcon code={currentCarrier.code} size={12} />
                </div>
              )}
              <span className="text-foreground truncate">{displayText}</span>
            </div>
            <ChevronDown
              className="size-3.5 text-muted-foreground shrink-0 transition-transform duration-150"
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {/* ── Dropdown panel (portaled to body to avoid clipping) ── */}
          {isOpen && dropdownPos && ReactDOM.createPortal(
            <div
              ref={dropdownRef}
              className="fixed flex rounded-[var(--radius)] overflow-hidden"
              style={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "var(--elevation-lg)",
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                width: `${dropdownPos.width}px`,
                maxHeight: "360px",
                /* Sit above any host Dialog (Radix DialogContent = z-50)
                   and restore pointer-events — Radix Dialog applies
                   `pointer-events: none` to body while open, which
                   would otherwise swallow method clicks when this
                   dropdown is portaled to body. Same fix used by
                   the Duplicate PO version panel. */
                zIndex: 12500,
                pointerEvents: "auto",
              }}
            >
              {/* ── Left panel: Carriers ── */}
              <div
                className="flex flex-col shrink-0"
                style={{
                  width: "200px",
                  borderRight: "1px solid hsl(var(--border))",
                }}
              >
                {/* Search */}
                <div className="p-2" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  <div
                    className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] border border-border"
                    style={{ backgroundColor: "hsl(var(--input-background))" }}
                  >
                    <Search className="size-3 text-muted-foreground shrink-0" />
                    <input
                      ref={carrierSearchRef}
                      type="text"
                      placeholder="Search carriers..."
                      value={carrierSearch}
                      onChange={(e) => setCarrierSearch(e.target.value)}
                      className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                      style={{ fontSize: "11px", fontFamily: FONT }}
                    />
                    {carrierSearch && (
                      <button className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setCarrierSearch("")}>
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Create new */}
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-primary hover:bg-primary/[0.04] transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid hsl(var(--border))" }}
                >
                  <Plus className="size-3" />
                  <span style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                    Create New Carrier
                  </span>
                </button>

                {/* Carrier list */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  {filteredCarriers.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground" style={{ fontSize: "11px", fontFamily: FONT }}>
                      No carriers found
                    </div>
                  ) : (
                    filteredCarriers.map((carrier) => {
                      const isActive = carrier.code === activeCarrierCode;
                      const isCurrent = carrier.code === currentCarrier?.code;
                      return (
                        <button
                          key={carrier.code}
                          type="button"
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer transition-colors ${
                            isActive ? "bg-secondary" : "hover:bg-secondary/50"
                          }`}
                          style={{ borderBottom: "1px solid color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}
                          onMouseEnter={() => setHoveredCarrierCode(carrier.code)}
                          onClick={() => {
                            setSelectedCarrierCode(carrier.code);
                            setHoveredCarrierCode(null);
                            setMethodSearch("");
                          }}
                        >
                          <div
                            className="flex items-center justify-center size-6 rounded shrink-0"
                            style={{
                              backgroundColor: isCurrent ? "hsl(var(--primary-tint))" : "hsl(var(--secondary))",
                              color: isCurrent ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                            }}
                          >
                            <CarrierIcon code={carrier.code} size={13} />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-foreground truncate"
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "var(--font-weight-medium)",
                                  lineHeight: "16px",
                                  fontFamily: FONT,
                                }}
                              >
                                {carrier.name.length > 20 ? carrier.name.split("(")[0].trim() : carrier.name}
                              </span>
                              {carrier.isDefault && (
                                <span
                                  className="inline-flex items-center px-1 rounded-[var(--radius-sm)] shrink-0"
                                  style={{
                                    backgroundColor: "hsl(var(--primary-tint))",
                                    color: "hsl(var(--primary))",
                                    fontSize: "8px",
                                    fontWeight: "var(--font-weight-semibold)",
                                    lineHeight: "14px",
                                    fontFamily: FONT,
                                  }}
                                >
                                  Default
                                </span>
                              )}
                            </div>
                            <span
                              className="text-muted-foreground"
                              style={{ fontSize: "9px", fontWeight: "var(--font-weight-normal)", lineHeight: "13px", fontFamily: FONT }}
                            >
                              {carrier.code} · {carrier.methods.length} methods
                            </span>
                          </div>
                          <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Right panel: Methods ── */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <div className="p-2 flex flex-col gap-1.5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  <div className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] border border-border" style={{ backgroundColor: "hsl(var(--input-background))" }}>
                    <Search className="size-3 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Search methods..."
                      value={methodSearch}
                      onChange={(e) => setMethodSearch(e.target.value)}
                      className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                      style={{ fontSize: "11px", fontFamily: FONT }}
                    />
                    {methodSearch && (
                      <button className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setMethodSearch("")}>
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                  <button className="flex items-center gap-2 px-2 py-1 text-primary hover:bg-primary/[0.04] rounded-[var(--radius-sm)] transition-colors cursor-pointer">
                    <Plus className="size-3" />
                    <span style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                      Create Shipping Method
                    </span>
                  </button>
                </div>

                {/* Method list */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  {filteredMethods.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground" style={{ fontSize: "11px", fontFamily: FONT }}>
                      No methods found
                    </div>
                  ) : (
                    filteredMethods.map((method) => {
                      const isSelected = method.value === selectedMethodValue;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/[0.06]" : "hover:bg-secondary/50"
                          }`}
                          style={{ borderBottom: "1px solid color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}
                          onClick={() => handleSelectMethod(method.value)}
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-foreground"
                                style={{
                                  fontSize: "12px",
                                  fontWeight: isSelected ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                                  lineHeight: "16px",
                                  fontFamily: FONT,
                                }}
                              >
                                {method.label}
                              </span>
                              {method.isDefault && (
                                <span
                                  className="inline-flex items-center px-1 rounded-[var(--radius-sm)] shrink-0"
                                  style={{
                                    backgroundColor: "hsl(var(--primary-tint))",
                                    color: "hsl(var(--primary))",
                                    fontSize: "8px",
                                    fontWeight: "var(--font-weight-semibold)",
                                    lineHeight: "14px",
                                    fontFamily: FONT,
                                  }}
                                >
                                  Default
                                </span>
                              )}
                            </div>
                            <span
                              className="text-muted-foreground"
                              style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT }}
                            >
                              ({method.description})
                            </span>
                          </div>
                          <span
                            className="text-muted-foreground shrink-0"
                            style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }}
                          >
                            {method.eta}
                          </span>
                          {isSelected && (
                            <div
                              className="flex items-center justify-center size-4 rounded-full shrink-0"
                              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                            >
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* ── Field 2: Shipping Method (read-only) ── */}
      <div className="flex flex-col gap-0.5">
        <label
          className="text-muted-foreground flex items-center gap-1"
          style={{
            fontSize: "10px",
            fontWeight: "var(--font-weight-semibold)",
            lineHeight: "14px",
            fontFamily: FONT,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Shipping Method
        </label>
        <div
          className="flex items-center h-8 px-2.5 rounded-[var(--radius)] border border-border"
          style={{
            backgroundColor: "hsl(var(--secondary))",
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-weight-normal)",
            lineHeight: "18px",
            fontFamily: FONT,
            color: currentMethod ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          }}
        >
          {methodDisplayText}
        </div>
      </div>
    </div>
  );
}
