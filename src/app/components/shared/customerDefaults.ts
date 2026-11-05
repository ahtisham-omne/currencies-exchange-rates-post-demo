/* Mirror of the Quote module's customerDefaults helper. Kept in sync
   so the Change Customer flow on the SO sidebar hydrates the same
   shape (primaryPoC, pocs, sales rep, billing/shipping addresses,
   payment terms + method) when the user picks a different customer
   on an order that hasn't shipped yet. */

/** Every field except the roster can be null: Partners only requires a
 *  customer's name. See SPARSE customers below. */
export interface CustomerDefaults {
  primaryPoC: null | {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string;
    initials: string;
  };
  pocs: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string;
    initials: string;
    isPrimary: boolean;
  }>;
  salesRep: { id: string; name: string; initials: string; email: string } | null;
  billingAddress: null | {
    id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    isDefault: boolean;
  };
  shippingAddress: null | {
    id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    isDefault: boolean;
  };
  paymentTerms: { id: string; name: string } | null;
  paymentMethod: { id: string; name: string; icon: string } | null;
}

const PAYMENT_TERMS = [
  { id: 'net15', name: 'Net 15' },
  { id: 'net30', name: 'Net 30' },
  { id: 'net45', name: 'Net 45' },
  { id: 'net60', name: 'Net 60' },
];
const PAYMENT_METHODS = [
  { id: 'ach', name: 'ACH/Direct Deposit', icon: 'CreditCard' },
  { id: 'wire', name: 'Wire Transfer', icon: 'Send' },
  { id: 'card', name: 'Corporate Card', icon: 'CreditCard' },
  { id: 'check', name: 'Check', icon: 'FileText' },
];
const SALES_REPS = [
  { id: 'rep-sm', name: 'Sarah Moore',  initials: 'SM', email: 'sarah.moore@pioneer.com' },
  { id: 'rep-mj', name: 'Mike Johnson', initials: 'MJ', email: 'mike.johnson@pioneer.com' },
  { id: 'rep-ew', name: 'Emily Williams', initials: 'EW', email: 'emily.williams@pioneer.com' },
  { id: 'rep-dc', name: 'David Chen',  initials: 'DC', email: 'david.chen@pioneer.com' },
];
const POC_ROLES = ['Procurement Manager', 'Fleet Manager', 'Operations Director', 'Finance Lead', 'Engineering Manager'];
const POC_FIRST_NAMES = ['Mary', 'James', 'Anna', 'Tom', 'Lisa', 'David', 'Susan', 'Robert'];
const POC_LAST_NAMES = ['Garcia', 'Mitchell', 'Kim', 'Parker', 'Huang', 'Chen', 'Brennan', 'Reyes'];
const ADDR_STREETS = ['123 Industrial Way', '4500 Logistics Blvd', '900 Corporate Center', '17 Commerce Park', '2200 Pioneer Ave', '88 Distribution Dr'];
const CITIES: Array<{ city: string; state: string; zip: string }> = [
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Atlanta', state: 'GA', zip: '30303' },
  { city: 'Denver', state: 'CO', zip: '80202' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function initials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
}
function pocAt(idx: number, h: number, customerName: string): { id: string; name: string; email: string; role: string; phone: string; initials: string } {
  const first = POC_FIRST_NAMES[(h + idx * 7) % POC_FIRST_NAMES.length];
  const last = POC_LAST_NAMES[(h + idx * 11) % POC_LAST_NAMES.length];
  const name = `${first} ${last}`;
  const domain = customerName.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 12) || 'partner';
  const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}.com`;
  const role = POC_ROLES[(h + idx * 13) % POC_ROLES.length];
  const areaCode = 200 + (h % 700);
  const lineNum = 1000 + ((h + idx * 17) % 9000);
  const phone = `+1 (${areaCode}) ${String(Math.floor(lineNum / 100)).padStart(3, '0')}-${String(lineNum % 100).padStart(2, '0')}${(h % 10)}`;
  return { id: `poc-${h}-${idx}`, name, email, role, phone, initials: initials(name) };
}

/* ── Sparse customers ──
   Partners only requires a customer's name. Customers listed here
   have nothing else on file (no contacts, addresses, payment terms,
   payment method or sales rep), so the UI can be exercised against
   the real "missing data" case instead of the hash-derived defaults
   every other customer gets. Add a name here to make any customer
   sparse. */
export const SAMPLE_EMPTY_CUSTOMER = {
  id: 'c_harbor_point',
  name: 'Harbor Point Rescue Squad',
  initials: 'HP',
} as const;

const SPARSE_CUSTOMER_NAMES = new Set<string>([SAMPLE_EMPTY_CUSTOMER.name]);

export function isSparseCustomer(customerName: string | null | undefined): boolean {
  return !!customerName && SPARSE_CUSTOMER_NAMES.has(customerName.trim());
}

/** Defaults for a customer that only has a name on file. */
export const EMPTY_CUSTOMER_DEFAULTS: CustomerDefaults = {
  primaryPoC: null,
  pocs: [],
  salesRep: null,
  billingAddress: null,
  shippingAddress: null,
  paymentTerms: null,
  paymentMethod: null,
};

export function getCustomerDefaults(customerName: string): CustomerDefaults {
  if (isSparseCustomer(customerName)) return EMPTY_CUSTOMER_DEFAULTS;
  const h = hashName(customerName);
  const primary = pocAt(0, h, customerName);
  const pocs = [0, 1, 2].map(i => ({ ...pocAt(i, h, customerName), isPrimary: i === 0 }));
  const rep = SALES_REPS[h % SALES_REPS.length];
  const billCity = CITIES[h % CITIES.length];
  const shipCity = CITIES[(h + 3) % CITIES.length];
  const billStreet = ADDR_STREETS[h % ADDR_STREETS.length];
  const shipStreet = ADDR_STREETS[(h + 2) % ADDR_STREETS.length];
  return {
    primaryPoC: primary,
    pocs,
    salesRep: rep,
    billingAddress: {
      id: `addr-bill-${h}`,
      label: 'Headquarters',
      street: billStreet,
      city: billCity.city,
      state: billCity.state,
      zip: billCity.zip,
      country: 'United States',
      isDefault: true,
    },
    shippingAddress: {
      id: `addr-ship-${h}`,
      label: 'Primary Warehouse',
      street: shipStreet,
      city: shipCity.city,
      state: shipCity.state,
      zip: shipCity.zip,
      country: 'United States',
      isDefault: false,
    },
    paymentTerms: PAYMENT_TERMS[h % PAYMENT_TERMS.length],
    paymentMethod: PAYMENT_METHODS[(h + 1) % PAYMENT_METHODS.length],
  };
}
