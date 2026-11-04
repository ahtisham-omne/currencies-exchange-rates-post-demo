// Vendor-level Freight & Logistics carriers. Each vendor inherits a
// default carrier set from its partner / vendor configuration, but -- just
// like payment terms -- the invoicing user can override the carrier for a
// single invoice (or push the change back to the vendor profile). The shape
// + catalogue mirrors the partner module's SHIPPING_CARRIER_CATALOG so the
// cards look identical across the two flows.

export type CarrierMode = 'air' | 'ground' | 'sea' | 'multi';
export type CarrierStatus = 'Active' | 'Under Review' | 'Inactive';

export interface VendorCarrier {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  colorBg: string;
  colorText: string;
  desc: string;
  mode: CarrierMode;
  region: string;
  methodName: string;
  minDays: number;
  maxDays: number;
  status: CarrierStatus;
  isPrimary: boolean;
}

// Shared catalogue. Same names + descriptions as the partner module
// so users recognise the carrier identities across both apps. Exported so
// the invoice-level "Change carrier" browse modal can offer the full set,
// mirroring how the payment-terms picker browses PAYMENT_TERM_PRESETS.
export const CARRIER_CATALOGUE: VendorCarrier[] = [
  {
    id: 'fedex-freight',
    name: 'FedEx Freight',
    shortName: 'FedEx',
    initials: 'FX',
    colorBg: '#F3E8FF',
    colorText: '#5B21B6',
    desc: 'Premium air & ground shipping for time-critical deliveries.',
    mode: 'air',
    region: 'North America',
    methodName: 'FedEx Ground',
    minDays: 5,
    maxDays: 7,
    status: 'Active',
    isPrimary: true,
  },
  {
    id: 'dhl-express',
    name: 'DHL Express Worldwide',
    shortName: 'DHL',
    initials: 'DX',
    colorBg: '#FEF9C3',
    colorText: '#854D0E',
    desc: 'Door-to-door international express across 220+ countries.',
    mode: 'air',
    region: 'Global',
    methodName: 'DHL Express Worldwide',
    minDays: 1,
    maxDays: 3,
    status: 'Active',
    isPrimary: false,
  },
  {
    id: 'ups-ground',
    name: 'UPS Freight',
    shortName: 'UPS',
    initials: 'UP',
    colorBg: '#FEF3C7',
    colorText: '#78350F',
    desc: 'Reliable LTL ground freight across the continental US.',
    mode: 'ground',
    region: 'North America',
    methodName: 'UPS Ground',
    minDays: 5,
    maxDays: 7,
    status: 'Active',
    isPrimary: false,
  },
  {
    id: 'maersk-ocean',
    name: 'Maersk Line',
    shortName: 'Maersk',
    initials: 'MK',
    colorBg: '#DBEAFE',
    colorText: '#1E3A8A',
    desc: 'World-leading ocean container shipping for FTL cargo.',
    mode: 'sea',
    region: 'Global',
    methodName: 'Maersk Ocean Freight',
    minDays: 21,
    maxDays: 45,
    status: 'Under Review',
    isPrimary: false,
  },
  {
    id: 'ontrac',
    name: 'OnTrac',
    shortName: 'OnTrac',
    initials: 'OT',
    colorBg: '#FFEDD5',
    colorText: '#9A3412',
    desc: 'Regional parcel carrier, West Coast next-day deliveries.',
    mode: 'ground',
    region: 'US West',
    methodName: 'OnTrac Ground',
    minDays: 1,
    maxDays: 3,
    status: 'Active',
    isPrimary: false,
  },
];

export const CARRIER_MODE_LABEL: Record<CarrierMode, string> = {
  air: 'Air',
  ground: 'Ground',
  sea: 'Sea',
  multi: 'Multi-Modal',
};

export const CARRIER_MODE_COLORS: Record<CarrierMode, { bg: string; text: string; border: string }> = {
  air: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  ground: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  sea: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  multi: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

// Deterministic per-vendor carrier list: hash the vendorCode to pick a
// 2- or 3-carrier subset of the catalogue so each vendor's freight
// section feels unique without having to author per-vendor records.
export function getCarriersForVendor(vendorCode: string | undefined): VendorCarrier[] {
  if (!vendorCode) return CARRIER_CATALOGUE.slice(0, 2);
  let h = 0;
  for (let i = 0; i < vendorCode.length; i++) {
    h = vendorCode.charCodeAt(i) + ((h << 5) - h);
  }
  const abs = Math.abs(h);
  const count = (abs % 2) + 2; // 2 or 3 carriers
  const start = abs % CARRIER_CATALOGUE.length;
  const out: VendorCarrier[] = [];
  for (let i = 0; i < count; i++) {
    out.push(CARRIER_CATALOGUE[(start + i) % CARRIER_CATALOGUE.length]);
  }
  // Ensure exactly one carrier is marked primary in this slice.
  return out.map((c, i) => ({ ...c, isPrimary: i === 0 }));
}

// Resolve a carrier by id from the shared catalogue. Used by the invoice
// freight section to render whichever carrier the user has selected.
export function findCarrierById(id: string | null | undefined): VendorCarrier | undefined {
  if (!id) return undefined;
  return CARRIER_CATALOGUE.find((c) => c.id === id);
}
