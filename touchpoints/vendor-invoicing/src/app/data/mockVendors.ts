import { mulberry32 } from './seededRandom';
import { presetForVendor } from './paymentTermPresets';
import { currencyForVendorName } from '@/app/currency/invoiceFx';
import { midRateOn } from '@/app/currency/rates';

// Seeded so the vendor / PO / line-item dataset is stable across
// reloads — see mockInvoices.ts for the rationale.
const rand = mulberry32(0x4E7D0F5);

export interface LineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty?: number;
  invoicedQty?: number;
  image?: string;
  [key: string]: any;
}

export interface VendorPO {
  poNumber: string;
  poDate: string;
  poAmount: number;
  status: string;
  itemCount: number;
  items: LineItem[];
  invoicedAmount?: number; // New: track invoiced amount at PO level
  /** Payment terms on the PO itself (8/25/26): inherits the vendor's term
   *  by default, but a PO can carry its own. An invoice spanning POs with
   *  different terms is allowed and warns the user to pick one. */
  paymentTerms?: string;
  /** The PO's currency: the vendor's when it was raised (spec 4.3). An
   *  invoice from this PO defaults to it. */
  currency?: string;
  /** Base currency per one unit of `currency` on the PO date (mid-market). */
  exchangeRate?: number;
}

export interface VendorGRN {
  grnNumber: string;
  grnDate: string;
  receivedQty: number;
  poNumber: string;
  status: string;
  items: LineItem[];
  vendorName?: string; // For global view
  vendorCode?: string; // For global view
}

export interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  category: string;
  currency: string;
  paymentTerms: string;
  purchaseOrders: VendorPO[];
  receivingDocuments: VendorGRN[];
  createdBy: string;
  createdOn: string;
  type: 'Domestic' | 'International' | 'Service' | 'Manufacturing';
  imageUrl?: string;
  /** Partner-level default expense account (GL) used to pre-fill standalone
   *  invoice line items for this vendor. Optional — not every vendor has one
   *  configured, in which case the line GL starts empty. */
  defaultExpenseAccount?: string;
  /** Partner-level payment methods this vendor accepts (values match
   *  PAYMENT_METHODS in mockPayments). The Record-payment flow offers these and
   *  defaults to `primaryPaymentMethod`. */
  paymentMethods?: string[];
  primaryPaymentMethod?: string;
}

// Deterministic per-vendor payment-method sets (values match
// mockPayments.PAYMENT_METHODS). Pulled into the Record-payment flow so the
// method field reflects what the partner actually accepts, defaulting to the
// primary. Index-seeded so a vendor always gets the same set.
const VENDOR_METHOD_SETS: { methods: string[]; primary: string }[] = [
  { methods: ['ACH', 'Wire', 'Check'], primary: 'ACH' },
  { methods: ['Wire', 'Bank Transfer'], primary: 'Wire' },
  { methods: ['Card', 'ACH'], primary: 'Card' },
  { methods: ['Check', 'ACH', 'Bank Transfer'], primary: 'Check' },
  { methods: ['Bank Transfer', 'ACH', 'Wire', 'Card'], primary: 'Bank Transfer' },
];

/** Deterministic per-vendor payment methods by name — works for any vendor
 *  string (including invoice-sourced names that aren't in mockVendors), so the
 *  Record-payment flow can always resolve a partner-level method set + primary. */
export function paymentMethodsForVendor(vendorName: string): { methods: string[]; primary: string } {
  const h = (vendorName || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return VENDOR_METHOD_SETS[h % VENDOR_METHOD_SETS.length];
}

const vendorCategories = [
  'Seller (Items)',
  'Sub Contractor',
  'Service Provider',
  'Carrier'
];

const companyPrefixes = [
  'Acme', 'Global', 'Premier', 'United', 'Superior', 'Advanced', 'Elite', 'Prime',
  'Mega', 'Ultra', 'Dynamic', 'Strategic', 'Precision', 'Quality', 'Reliable',
  'Phoenix', 'Summit', 'Apex', 'Nexus', 'Vertex', 'Quantum', 'Stellar', 'Titan',
  'Vanguard', 'Zenith', 'Alpha', 'Beta', 'Sigma', 'Omega', 'Delta'
];

const companySuffixes = [
  'Corp', 'Industries', 'Solutions', 'Systems', 'Technologies', 'Services',
  'Enterprises', 'Group', 'International', 'Global', 'Associates', 'Partners',
  'Supply Co', 'Manufacturing', 'Distribution', 'Logistics', 'Trading'
];

function generateVendorName(index: number): string {
  const prefix = companyPrefixes[index % companyPrefixes.length];
  const suffix = companySuffixes[Math.floor(index / companyPrefixes.length) % companySuffixes.length];
  return `${prefix} ${suffix}`;
}

// Shared image pool — every catalogue entry picks one of these via a
// deterministic hash so we don't store unique image URLs per item.
const ITEM_IMG_POOL = [
  'https://images.unsplash.com/photo-1672689933227-2ce1249c46a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1758857087505-957823893209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1713575882582-8938739db351?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1737223450913-2af6885945e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1661069387900-54d5843b704d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
];
const imgForSku = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  return ITEM_IMG_POOL[Math.abs(h) % ITEM_IMG_POOL.length];
};

// 35-entry catalogue spanning electronics, hardware, hydraulic, safety,
// packaging, office, machinery, tooling, raw material, and consumables.
// Picker rendering can now sample broadly so adjacent POs surface
// noticeably different line items.
const ITEM_CATALOGUE = [
  // Electronics
  { sku: 'ELEC-M-992', desc: 'Power Management IC - High Efficiency 450V', uom: 'PC' },
  { sku: 'ELEC-CAP-470', desc: 'Capacitor 470uF 50V Electrolytic', uom: 'PC' },
  { sku: 'ELEC-PCB-A4', desc: 'PCB Substrate FR4 - Single Layer', uom: 'SHT' },
  { sku: 'ELEC-LED-W5', desc: 'High-Lumen White LED Module 5W', uom: 'PC' },
  { sku: 'ELEC-SENS-T1', desc: 'Industrial Temperature Sensor PT100', uom: 'PC' },
  // Cabling
  { sku: 'CAB-XL-10', desc: 'Heavy Duty 10AWG Copper Cable - Shielded', uom: 'm' },
  { sku: 'CAB-FOC-12', desc: 'Fiber Optic Cable 12-Strand Single-Mode', uom: 'm' },
  { sku: 'CAB-CAT6-FT', desc: 'CAT6 Ethernet Cable - Plenum Rated', uom: 'ft' },
  // Hardware
  { sku: 'BRKT-IND-22', desc: 'Mounting Brackets - Galvanized Steel', uom: 'EA' },
  { sku: 'BOLT-M12-H', desc: 'Hex Head Bolts M12 x 50mm - Stainless', uom: 'BX' },
  { sku: 'NUT-M12-L', desc: 'Lock Nuts M12 - Nyloc Stainless', uom: 'BX' },
  { sku: 'WASH-M12', desc: 'Flat Washers M12 - Zinc Plated', uom: 'BX' },
  // Raw material
  { sku: 'STEEL-001', desc: 'Industrial Steel Pipes 2"', uom: 'EA' },
  { sku: 'STEEL-SHEET-4', desc: 'Steel Sheet 4mm Hot-Rolled', uom: 'SHT' },
  { sku: 'ALU-EXT-2X', desc: 'Aluminum Extrusion 2"x2" T-Slot', uom: 'ft' },
  { sku: 'COPPER-042', desc: 'Copper Fittings 1/2" NPT', uom: 'ft' },
  // Welding / Tools
  { sku: 'WELD-99', desc: 'Welding Rods Pack E7018', uom: 'PK' },
  { sku: 'WELD-WIRE-S', desc: 'MIG Welding Wire 0.045" - Steel', uom: 'RL' },
  { sku: 'TOOL-DRL-18V', desc: 'Cordless Drill Driver 18V', uom: 'SET' },
  { sku: 'TOOL-WRN-MET', desc: 'Metric Combination Wrench Set 8-19mm', uom: 'SET' },
  { sku: 'TOOL-CAL-DG', desc: 'Digital Caliper 6" Stainless', uom: 'EA' },
  // Hydraulic
  { sku: 'HYD-FL-5L', desc: 'Hydraulic Fluid AW46 - 5L', uom: 'lb' },
  { sku: 'HYD-HOSE-1', desc: 'Hydraulic Hose 1" SAE 100R2 - Per Foot', uom: 'ft' },
  { sku: 'HYD-PMP-A2', desc: 'Hydraulic Gear Pump 2.5GPM', uom: 'EA' },
  // Safety / PPE
  { sku: 'SAFE-H-01', desc: 'Safety Helmets - ANSI Class E', uom: 'EA' },
  { sku: 'SAFE-GLASS', desc: 'Anti-Fog Safety Glasses', uom: 'EA' },
  { sku: 'SAFE-VEST-HV', desc: 'High-Visibility Safety Vest Class 2', uom: 'EA' },
  { sku: 'GLOVE-B', desc: 'Work Gloves (Bulk Pack)', uom: 'kg' },
  { sku: 'EAR-PRO-PK', desc: 'Disposable Ear Plugs Pack of 200', uom: 'BX' },
  // Office / Tech
  { sku: 'TECH-PC-01', desc: 'Office Workstation Hardware Pro', uom: 'SET' },
  { sku: 'TECH-MON-27', desc: '27" 4K Monitor - HDMI/DP', uom: 'EA' },
  { sku: 'OFFICE-CHR', desc: 'Ergonomic Task Chair - Mesh Back', uom: 'EA' },
  // Packaging / Consumables
  { sku: 'PKG-BOX-L', desc: 'Corrugated Shipping Box Large 18x18x18', uom: 'BX' },
  { sku: 'PKG-WRAP-R', desc: 'Stretch Wrap Roll 18" x 1500ft', uom: 'RL' },
  { sku: 'PKG-LABEL-4', desc: 'Thermal Shipping Labels 4x6 Pack', uom: 'PK' },
];

function generatePOs(vendorCode: string, count: number): VendorPO[] {
  const pos: VendorPO[] = [];
  const statuses = ['Confirmed', 'Partially Received', 'Fully Received', 'Closed', 'Partially Invoiced', 'Fully Invoiced'];

  // Per-PO line-count buckets so adjacent POs visibly differ in scale.
  // Cycle through small / medium / large / extra-large so a vendor's
  // PO list reads as a mix.
  const countBuckets: Array<[number, number]> = [
    [8, 14],   // small PO
    [18, 26],  // medium
    [34, 44],  // large
    [50, 60],  // extra large
  ];

  for (let i = 0; i < count; i++) {
    const year = 2024;
    const month = (i % 12) + 1;
    const [minCnt, maxCnt] = countBuckets[i % countBuckets.length];
    const itemCount = Math.floor(rand() * (maxCnt - minCnt + 1)) + minCnt;
    const items: LineItem[] = [];
    let poAmount = 0;
    let invoicedAmount = 0;

    const poStatus = statuses[i % statuses.length];

    // Each PO advances its starting offset by a non-trivial step so
    // adjacent POs sample different sections of the catalogue. Prime
    // step (7) over a 35-entry list keeps the rotation aperiodic
    // across the typical 5-7 POs per vendor.
    const itemListOffset = (i * 7) % ITEM_CATALOGUE.length;
    for (let j = 0; j < itemCount; j++) {
      const baseItem = ITEM_CATALOGUE[(j + itemListOffset) % ITEM_CATALOGUE.length];
      const qty = Math.floor(rand() * 50) + 10;
      const price = Math.round((rand() * 50 + 5) * 100) / 100;
      const total = Math.round(qty * price * 100) / 100;
      
      let receivedQty = 0;
      let invoicedQty = 0;

      if (poStatus === 'Fully Received' || poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        receivedQty = qty;
      } else if (poStatus === 'Partially Received') {
        // Demo requirement (Eli 9/8, S8-07): every partially received PO
        // carries ONE fully received line so the pre-invoice flow's
        // line-level grey-out shows in the demo data.
        receivedQty = j === 0 ? qty : Math.floor(qty * 0.5);
      } else if (poStatus === 'Partially Invoiced') {
        // Billing implies receiving in the post flow: a partially
        // invoiced PO's lines are received, the first one in full.
        receivedQty = j === 0 ? qty : Math.floor(qty * 0.6);
      }

      if (poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        invoicedQty = qty;
      } else if (poStatus === 'Partially Invoiced') {
        // First line fully received AND fully invoiced (user 9/22): every
        // partially invoiced PO demos the line-level "Fully invoiced"
        // grey-out + tooltip while its other lines stay billable.
        invoicedQty = j === 0 ? qty : Math.floor(qty * 0.4);
      }

      poAmount += total;
      invoicedAmount += (invoicedQty * price);

      // Each generated line gets a unique item number even when itemCount exceeds
      // the base list — `${baseItem.sku}-${j+1}` keeps the item number family
      // recognizable while preventing duplicate rows inside a single PO.
      items.push({
        id: `item-${vendorCode}-${i}-${j}`,
        sku: `${baseItem.sku}-${String(j + 1).padStart(2, '0')}`,
        description: baseItem.desc,
        quantity: qty,
        uom: baseItem.uom,
        unitPrice: price,
        totalPrice: total,
        receivedQty: receivedQty,
        invoicedQty: invoicedQty,
        image: imgForSku(baseItem.sku),
      });
    }

    pos.push({
      // Plain integer PO sequence per BA UX feedback — vendor index
      // determines the hundred (V002 -> 1020s, V003 -> 1030s, …) so
      // numbers stay unique across the dataset while still reading
      // as a flat sequence to the user.
      poNumber: String(1000 + parseInt(vendorCode.split('-')[1] || '0') * 10 + i + 1),
      poDate: `${year}-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      poAmount: Math.round(poAmount * 100) / 100,
      invoicedAmount: Math.round(invoicedAmount * 100) / 100,
      status: poStatus,
      itemCount: itemCount,
      items: items
    });
  }
  
  return pos;
}

function generateGRNs(pos: VendorPO[]): VendorGRN[] {
  const grns: VendorGRN[] = [];
  const statuses = ['Received', 'Inspected', 'Accepted', 'Partially Invoiced', 'Fully Invoiced'];
  
  // Logic for Multi-PO and Multi-GRN mapping
  // We'll process some POs normally, and some in a complex way
  
  const processedPOIndices = new Set<number>();

  // 1. Create a consolidated GRN that spans multiple POs
  if (pos.length >= 2) {
    const po1 = pos[0];
    const po2 = pos[1];
    
    const combinedItems: LineItem[] = [];
    [po1, po2].forEach(po => {
      po.items.slice(0, 3).forEach(item => {
        if ((item.receivedQty || 0) > 0) {
          combinedItems.push({
            ...item,
            quantity: item.receivedQty || 0,
            totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100
          });
        }
      });
    });

    if (combinedItems.length > 0) {
      grns.push({
        grnNumber: `REC-MULTI-${Math.floor(rand() * 9000) + 1000}`,
        grnDate: '2024-12-15',
        receivedQty: combinedItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: `${po1.poNumber}, ${po2.poNumber}`,
        status: 'Accepted',
        items: combinedItems
      });
    }
  }

  // 2. Create multiple receiving documents for 3 POs (to ensure 3+ GRNs)
  const poIndicesToSplit = [2, 3, 4].filter(idx => idx < pos.length);
  
  poIndicesToSplit.forEach(idx => {
    const po = pos[idx];
    if (po.status === 'Confirmed' || po.items.every(i => (i.receivedQty || 0) === 0)) return;

    const splitCount = 3 + (idx % 2); // 3 or 4
    const testItems = po.items.filter(item => (item.receivedQty || 0) > 0);
    
    if (testItems.length === 0) return;

    // We track how much of each item has been assigned to GRNs
    const assignedQtys = new Map<string, number>();

    for (let i = 0; i < splitCount; i++) {
      const grnDate = new Date(po.poDate);
      grnDate.setDate(grnDate.getDate() + 5 + i + (idx * 2));

      const grnItems = testItems.map(item => {
        const totalReceived = item.receivedQty || 0;
        const previouslyAssigned = assignedQtys.get(item.id) || 0;
        const remaining = totalReceived - previouslyAssigned;
        
        if (remaining <= 0) return null;

        let qty = 0;
        if (i === splitCount - 1) {
          // Last GRN gets the rest
          qty = remaining;
        } else {
          // Randomly decide if this item is in this GRN (80% chance for variety)
          if (rand() > 0.8 && testItems.length > 3) return null;
          
          // Assign a random portion (between 10% and 50% of total)
          const randomFactor = 0.1 + (rand() * 0.4);
          qty = Math.max(1, Math.floor(totalReceived * randomFactor));
          qty = Math.min(qty, remaining - (splitCount - 1 - i)); // Ensure enough left for future GRNs
        }
        
        if (qty <= 0) return null;
        
        assignedQtys.set(item.id, previouslyAssigned + qty);
          
        return {
          ...item,
          quantity: qty,
          totalPrice: Math.round((item.unitPrice * qty) * 100) / 100
        };
      }).filter((item): item is LineItem => item !== null);

      if (grnItems.length > 0) {
        grns.push({
          grnNumber: `REC-SPLIT-${po.poNumber.split('-').pop()}-${i + 1}`,
          grnDate: grnDate.toISOString().split('T')[0],
          receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
          poNumber: po.poNumber,
          status: 'Received',
          items: grnItems
        });
      }
    }
    processedPOIndices.add(idx);
  });

  // 3. Process remaining POs normally
  pos.forEach((po, index) => {
    if (processedPOIndices.has(index)) return;
    if (po.status === 'Confirmed' || po.items.every(i => (i.receivedQty || 0) === 0)) return;

    const poDate = new Date(po.poDate);
    const grnDate = new Date(poDate);
    grnDate.setDate(grnDate.getDate() + Math.floor(rand() * 10) + 5);
    
    const grnItems: LineItem[] = po.items
      .filter(item => (item.receivedQty || 0) > 0)
      .map(item => ({
        ...item,
        quantity: item.receivedQty || 0,
        totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100
      }));

    if (grnItems.length > 0) {
      grns.push({
        grnNumber: `REC-2024-${String(index * 100 + 5000).padStart(6, '0')}`,
        grnDate: grnDate.toISOString().split('T')[0],
        receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: po.poNumber,
        status: po.status === 'Fully Invoiced' ? 'Fully Invoiced' : statuses[index % statuses.length],
        items: grnItems
      });
    }
  });
  
  return grns;
}

/* Pipeline POs (9/4/26 Eli review, BB-07): a PO has three lifecycle states
 * before receiving — Draft → Sent → Confirmed — and the Pre-Invoice flow
 * shows everything PAST draft ("once I've sent it, I don't necessarily get
 * confirmation... Amazon doesn't send you a confirmation"). Every vendor
 * gets one 'Sent' PO (ordered, nothing received) and every third vendor a
 * 'Draft' PO, which appears in NEITHER create flow. Appended AFTER the
 * seeded generators with fully deterministic values so the existing rand()
 * stream — and every PO/GRN it produced — stays byte-identical. Numbering
 * lives in the free 8000-8399 band (special-case Acme holds 1001-1008, the
 * generated bands start at 11011). */
function appendPipelinePOs(pos: VendorPO[], vendorCode: string, vendorIndex: number): void {
  const mk = (kind: 'Sent' | 'Draft', slot: number): VendorPO => {
    const itemCount = 6 + (vendorIndex % 4) * 2;
    const offset = (vendorIndex * 5 + slot * 3) % ITEM_CATALOGUE.length;
    const items: LineItem[] = [];
    let poAmount = 0;
    for (let j = 0; j < itemCount; j++) {
      const baseItem = ITEM_CATALOGUE[(j + offset) % ITEM_CATALOGUE.length];
      const qty = 20 + ((vendorIndex + j) % 6) * 10;
      const price = Math.round((12 + ((vendorIndex * 7 + j * 3) % 40)) * 100) / 100;
      const total = Math.round(qty * price * 100) / 100;
      poAmount += total;
      items.push({
        id: `item-${vendorCode}-p${slot}-${j}`,
        sku: `${baseItem.sku}-${String(j + 1).padStart(2, '0')}`,
        description: baseItem.desc,
        quantity: qty,
        uom: baseItem.uom,
        unitPrice: price,
        totalPrice: total,
        receivedQty: 0,
        invoicedQty: 0,
        image: imgForSku(baseItem.sku),
      });
    }
    return {
      poNumber: String(8000 + vendorIndex * 10 + slot + 1),
      poDate: `2024-${kind === 'Sent' ? '11' : '12'}-${String((vendorIndex % 27) + 1).padStart(2, '0')}`,
      poAmount: Math.round(poAmount * 100) / 100,
      invoicedAmount: 0,
      status: kind,
      itemCount,
      items,
    };
  };
  pos.push(mk('Sent', 0));
  if (vendorIndex % 3 === 0) pos.push(mk('Draft', 1));
}

export const mockVendors: Vendor[] = Array.from({ length: 40 }, (_, index) => {
  const vendorCode = `V-${String(1000 + index).padStart(5, '0')}`;
  const vendorName = generateVendorName(index);
  const category = vendorCategories[index % vendorCategories.length];
  
  let pos: VendorPO[];
  let grns: VendorGRN[];

  if (index === 0) {
    // Special case for the first vendor to have complex data
    // We need: Confirmed, Partially Received, Fully Received, Partially Invoiced
    const statuses = ['Confirmed', 'Partially Received', 'Fully Received', 'Partially Invoiced', 'Closed', 'Fully Invoiced'];
    pos = [];
    grns = [];

    // Per-PO size variance for Acme so the picker shows genuinely
    // different scales side-by-side (10, 28, 18, 42, 14, 50).
    const acmeItemCounts = [10, 28, 18, 42, 14, 50];
    // Per-PO unit price so totals don't all collapse to the same number.
    const acmePrices = [45.0, 28.5, 62.0, 51.25, 38.75, 84.0];

    statuses.forEach((status, i) => {
      const itemCount = acmeItemCounts[i] ?? 12;
      const items: LineItem[] = [];
      let poAmount = 0;
      let invoicedAmount = 0;

      // Each Acme PO samples a different aperiodic slice of the shared
      // catalogue (prime step over 35 entries) so PO 1 shows
      // electronics, PO 2 shows hardware/raw material, PO 3 shows
      // safety/PPE, etc., without overlap.
      const offset = (i * 11) % ITEM_CATALOGUE.length;
      for (let j = 0; j < itemCount; j++) {
        const baseItem = ITEM_CATALOGUE[(j + offset) % ITEM_CATALOGUE.length];

        const qty = 100;
        const price = acmePrices[i] ?? 50.0;
        const total = qty * price;

        let receivedQty = 0;
        let invoicedQty = 0;

        // Received Qty Logic
        if (status === 'Fully Received' || status === 'Fully Invoiced' || status === 'Closed') {
          receivedQty = qty;
        } else if (status === 'Partially Received' || status === 'Partially Invoiced') {
          // Demo requirement (Eli 9/8, S8-07; re-raised 9/22): the FIRST
          // vendor is the picker's first result, so its partially received
          // POs must carry a fully received line — the line-level grey-out
          // and lock show without hunting for a deeper vendor.
          receivedQty = j === 0 ? qty : 60;
        } else if (status === 'Confirmed') {
          receivedQty = 0;
        }

        // Invoiced Qty Logic
        if (status === 'Fully Invoiced' || status === 'Closed') {
          invoicedQty = qty;
        } else if (status === 'Partially Invoiced') {
          // First line fully received AND fully invoiced (user 9/22): the
          // PO stays partially invoiced on its other lines, so the picker
          // demos the line-level "Fully invoiced" grey-out + tooltip in
          // the very first vendor's results.
          invoicedQty = j === 0 ? qty : 30;
        } else if (status === 'Confirmed' && i === 0) {
          // Special case: Confirmed PO that is Pre-Invoiced (no receipts, but invoiced)
          invoicedQty = 40;
        }

        poAmount += total;
        invoicedAmount += (invoicedQty * price);

        // First-vendor special-case data cycles through the catalogue
        // -- suffix the item number with the line index so each line is unique,
        // matching the dedupe behavior of generatePOs above.
        items.push({
          id: `item-${vendorCode}-${i}-${j}`,
          sku: `${baseItem.sku}-${String(j + 1).padStart(2, '0')}`,
          description: baseItem.desc,
          quantity: qty,
          uom: baseItem.uom,
          unitPrice: price,
          totalPrice: total,
          receivedQty: receivedQty,
          invoicedQty: invoicedQty,
          image: imgForSku(baseItem.sku),
        });
      }

      // V001 special-case POs land in 1001-1099 so they don't collide
      // with the V002+ band (1021+) emitted by generatePOs.
      const poNumber = String(1000 + i + 1);
      pos.push({
        poNumber,
        poDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        poAmount,
        invoicedAmount,
        status: status === 'Confirmed' && invoicedAmount > 0 ? 'Partially Invoiced' : status,
        itemCount,
        items
      });

      // Create GRNs only for POs with receipts
      if (status !== 'Confirmed') {
        const receivedItems = items.filter(item => (item.receivedQty || 0) > 0);
        if (receivedItems.length > 0) {
          // Distribute GRNs with random variety
          const splitCount = i < 3 ? 4 : 2;
          const assignedQtys = new Map<string, number>();
          
          for (let s = 0; s < splitCount; s++) {
             let grnStatus = 'Not Invoiced';
             
             // Target specific GRN distributions
             if (status === 'Partially Invoiced') {
                if (s === 0) grnStatus = 'Fully Invoiced';
                else if (s === 1) grnStatus = 'Partially Invoiced';
                else grnStatus = 'Not Invoiced';
             } else if (status === 'Fully Invoiced' || status === 'Closed') {
                grnStatus = 'Fully Invoiced';
             } else {
                if (s === 0 && i % 2 === 0) grnStatus = 'Partially Invoiced';
                else grnStatus = 'Not Invoiced';
             }

             const finalItems = receivedItems.map((item, itemIdx) => {
                const totalReceived = item.receivedQty!;
                const previouslyAssigned = assignedQtys.get(item.id) || 0;
                const remaining = totalReceived - previouslyAssigned;

                if (remaining <= 0) return null;

                let share = 0;
                if (s === splitCount - 1) {
                  share = remaining;
                } else if (s === 0 && receivedItems.length >= 5) {
                  // Showcase a "partial GRN" case — the FIRST split keeps
                  // a deterministic subset (every 3rd item: indices 0, 3,
                  // 6, 9 …) instead of a random skip, so users can reliably
                  // demo the cross-tab selection sync: selecting this GRN
                  // ticks only those rows on the PO tab.
                  if (itemIdx % 3 !== 0) return null;
                  share = Math.max(1, Math.min(remaining, Math.floor(totalReceived * 0.4)));
                } else {
                  // Other splits: randomly skip some items (30% chance) and
                  // assign a 15-45% portion.
                  if (rand() > 0.7 && receivedItems.length > 2) return null;
                  const factor = 0.15 + (rand() * 0.3);
                  share = Math.max(1, Math.floor(totalReceived * factor));
                  share = Math.min(share, remaining - (splitCount - 1 - s));
                }

                if (share <= 0) return null;
                assignedQtys.set(item.id, previouslyAssigned + share);
                
                let itemInvoicedQty = 0;
                if (grnStatus === 'Fully Invoiced') itemInvoicedQty = share;
                else if (grnStatus === 'Partially Invoiced') itemInvoicedQty = Math.floor(share * (0.3 + rand() * 0.4));

                return {
                  ...item,
                  quantity: share,
                  totalPrice: Math.round(share * item.unitPrice * 100) / 100,
                  invoicedQty: itemInvoicedQty
                };
             }).filter((item): item is any => item != null) as LineItem[];

             // Line-level demo state (user 9/22): every partially
             // invoiced receiving carries ONE fully invoiced line so the
             // GRN tab's grey-out + tooltip shows, while the rest of the
             // document stays billable.
             if (grnStatus === 'Partially Invoiced' && finalItems.length > 1) {
               finalItems[0] = { ...finalItems[0], invoicedQty: finalItems[0].quantity };
             }

             if (finalItems.length > 0) {
                grns.push({
                  grnNumber: `REC-V001-PO${i + 1}-${String.fromCharCode(65 + s)}`,
                  grnDate: `2024-02-${String(1 + s * 5 + (i * 2)).padStart(2, '0')}`,
                  receivedQty: finalItems.reduce((sum, item) => sum + item.quantity, 0),
                  poNumber,
                  status: grnStatus,
                  items: finalItems,
                  vendorName,
                  vendorCode
                });
             }
          }
        }
      }
    });

    // Two genuinely uninvoiced Confirmed POs for Acme (8/13/26): the
    // pre-invoiced special case above converts the vendor's only
    // 'Confirmed' slot into Partially Invoiced, which left the demo
    // vendor with no invoiceable POs in the create-invoice picker.
    // Appended AFTER the existing six so
    // nothing above changes, and fully deterministic (no rand()) so
    // the seeded stream for every vendor after stays identical.
    const openItemCounts = [16, 22];
    const openPrices = [33.5, 47.25];
    openItemCounts.forEach((itemCount, k) => {
      const i = statuses.length + k; // continues the PO sequence: 1007, 1008
      const items: LineItem[] = [];
      let poAmount = 0;
      const offset = (i * 11) % ITEM_CATALOGUE.length;
      for (let j = 0; j < itemCount; j++) {
        const baseItem = ITEM_CATALOGUE[(j + offset) % ITEM_CATALOGUE.length];
        const qty = 100;
        const price = openPrices[k];
        const total = qty * price;
        poAmount += total;
        items.push({
          id: `item-${vendorCode}-${i}-${j}`,
          sku: `${baseItem.sku}-${String(j + 1).padStart(2, '0')}`,
          description: baseItem.desc,
          quantity: qty,
          uom: baseItem.uom,
          unitPrice: price,
          totalPrice: total,
          receivedQty: 0,
          invoicedQty: 0,
          image: imgForSku(baseItem.sku),
        });
      }
      pos.push({
        poNumber: String(1000 + i + 1),
        poDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        poAmount,
        invoicedAmount: 0,
        status: 'Confirmed',
        itemCount,
        items,
      });
    });
  } else {
    const poCount = Math.floor(rand() * 3) + 8;
    pos = generatePOs(vendorCode, poCount);
    grns = generateGRNs(pos).map((grn, gIdx) => {
      // Add variety to all vendors' GRNs to ensure 2+ of each status
      let grnStatus = grn.status;
      if (grnStatus !== 'Fully Invoiced' && grnStatus !== 'Partially Invoiced') {
        if (gIdx === 1 || gIdx === 3) grnStatus = 'Fully Invoiced';
        else if (gIdx === 2 || gIdx === 4) grnStatus = 'Partially Invoiced';
        else grnStatus = 'Not Invoiced';
      }
      // Line-level demo state (user 9/22): every partially invoiced
      // receiving carries ONE fully invoiced line (greyed + tooltip in
      // the picker) while its other lines stay billable — items inherit
      // the PO line's invoicedQty, so clamp the rest below their share.
      let items = grn.items;
      if (grnStatus === 'Partially Invoiced' && items.length > 1) {
        items = items.map((item, iIdx) => ({
          ...item,
          invoicedQty:
            iIdx === 0
              ? item.quantity
              : Math.min(item.invoicedQty ?? 0, Math.max(0, Math.floor(item.quantity * 0.5))),
        }));
      }
      return {
        ...grn,
        items,
        status: grnStatus,
        vendorName,
        vendorCode
      };
    });
  }
  
  // Sent + Draft pipeline POs for the Pre-Invoice flow (9/4/26, BB-07).
  appendPipelinePOs(pos, vendorCode, index);

  // Per-PO payment terms (8/25/26): POs inherit the vendor's term, but a
  // deterministic minority (every 4th PO) carry their own NET override so
  // the mixed-terms warning on multi-PO invoices is reachable in demos.
  {
    const vendorTerm = presetForVendor(vendorName).name;
    const termOverrides = ['Net 15', 'Net 30', 'Net 45 Post Receiving'];
    pos = pos.map((po, pIdx) => ({
      ...po,
      paymentTerms:
        pIdx % 4 === 3 ? termOverrides[(index + pIdx) % termOverrides.length] : vendorTerm,
    }));
  }

  // Currency & Exchange Rates (spec 4.2, 4.3): the partner record's default
  // currency, which its POs are raised in. Each PO keeps the mid-market rate
  // on its PO date, the commitment an invoice's own rate is compared with.
  const currency = currencyForVendorName(vendorName);
  pos = pos.map((po) => ({ ...po, currency, exchangeRate: midRateOn(currency, po.poDate) ?? undefined }));

  // First rows pinned to the real team (feedback 7/16/26; Irtaza above
  // Rida 8/12/26) — the same convention as mockInvoices/mockPayments, so
  // every data table leads with Ahtisham, Eli, Mahreen, Irtaza and Rida.
  const creators = ['Ahtisham Ahmad', 'Eli Rosenbloom', 'Mahreen Ghafoor', 'Irtaza Abid', 'Rida Iftikhar', 'Sarah Chen', 'James Wilson', 'Maria Garcia', 'Robert Taylor', 'Linda Martinez'];
  const types: ('Domestic' | 'International' | 'Service' | 'Manufacturing')[] = ['Domestic', 'International', 'Service', 'Manufacturing'];
  
  const createdOn = `2024-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`;

  // Partner-level default expense account — seeded on ~2 of every 3 vendors
  // so the standalone-invoice auto-pull demos both the "pre-filled" and the
  // "no default configured" states. Every 3rd vendor intentionally has none.
  const expenseDefaults = ['6000 General & Admin', '6100 Office Supplies', '5000 Cost of Goods Sold'];
  let defaultExpenseAccount = index % 3 === 2 ? undefined : expenseDefaults[index % expenseDefaults.length];
  // Demo guarantee: the standalone vendor picker is sorted "Newest first", so
  // its first row (Superior Industries) is pinned to NO default — showing the
  // empty / must-pick case — and its second row (Acme Industries) carries a
  // default — showing the auto-pull case.
  if (vendorName === 'Superior Industries') defaultExpenseAccount = undefined;
  else if (vendorName === 'Acme Industries') defaultExpenseAccount = '6000 General & Admin';

  return {
    id: `vendor-${index + 1}`,
    vendorCode,
    vendorName,
    category,
    currency,
    // Terms come from the partner template catalog (8/12/26), the same
    // vendor-name hash the run authoring pool uses, so both agree.
    paymentTerms: presetForVendor(vendorName).name,
    purchaseOrders: pos,
    receivingDocuments: grns,
    createdBy: creators[index % creators.length],
    createdOn: createdOn,
    type: types[index % types.length],
    imageUrl: index % 3 === 0 ? `https://images.unsplash.com/photo-${index % 2 === 0 ? '1486406146926-c627a92ad1ab' : '1497366216548-37526070297c'}?auto=format&fit=crop&q=80&w=100&h=100` : undefined,
    defaultExpenseAccount,
    paymentMethods: paymentMethodsForVendor(vendorName).methods,
    primaryPaymentMethod: paymentMethodsForVendor(vendorName).primary,
  };
});

/* ── Tolerant vendor resolution (Eli 9/25 demo bug) ───────────────────
 * The payments data names vendors off its own hardcoded list, which does
 * not always match this registry verbatim ("Acme Supplies Co." vs "Acme
 * Corp"; "Southern Industrial Supply" has no registry record at all).
 * ONE shared resolver — exact, then case-insensitive, then first-word —
 * so the deep-link vendor lock and the split-CTA availability check can
 * never disagree. Returns undefined when nothing matches; callers must
 * treat that as "no PO-backed flows for this vendor". */
export function resolveRegistryVendor(name: string | undefined | null): Vendor | undefined {
  if (!name) return undefined;
  const n = name.trim();
  if (!n) return undefined;
  return (
    mockVendors.find((v) => v.vendorName === n) ??
    mockVendors.find((v) => v.vendorName.toLowerCase() === n.toLowerCase()) ??
    mockVendors.find((v) => v.vendorName.toLowerCase().startsWith(n.toLowerCase().split(' ')[0]))
  );
}

/* ── In-session document consumption (8/13/26) ───────────────────────
 * Submitting an invoice must be REAL for the rest of the session: the
 * billed quantities post back onto the vendor's POs and receiving
 * documents so the create-invoice picker, vendor profile, and detail
 * views all agree (a fully invoiced PO drops out of the default picker
 * list via the existing closed-PO filter). Mutates the module data in
 * place; a browser refresh reseeds everything, which is the intended
 * reset point for user testing. */

export interface InvoicedLineRef {
  poNumber: string;
  sku: string;
  invoiceQty: number;
  grnNumbers?: string[];
}

/** Signed application of billed quantities onto a vendor's POs/GRNs
 *  (user 10/6, VI-01/VI-02): sign +1 bills the quantity, -1 gives it back.
 *  Editing an invoice RELEASES its prior lines then APPLIES the new ones
 *  (a replace, never a second add); cancelling releases, uncancelling
 *  re-applies. Clamped to [0, ordered] so repeated cycles can't drift
 *  negative or past the order. */
function adjustVendorDocs(vendorName: string, lines: InvoicedLineRef[], sign: 1 | -1): void {
  const vendor = mockVendors.find((v) => v.vendorName === vendorName);
  if (!vendor || lines.length === 0) return;

  const touchedPOs = new Set<string>();
  const touchedGRNs = new Set<string>();
  const clamp = (cur: number, delta: number, max: number) => Math.max(0, Math.min(max, (cur || 0) + delta));

  for (const line of lines) {
    if (!line.poNumber || line.invoiceQty <= 0) continue;
    const po = vendor.purchaseOrders.find((p) => p.poNumber === line.poNumber);
    if (!po) continue;
    const item = po.items.find((it) => it.sku === line.sku);
    if (!item) continue;
    item.invoicedQty = clamp(item.invoicedQty, sign * line.invoiceQty, item.quantity);
    touchedPOs.add(po.poNumber);

    // Mirror the consumption onto the GRNs the line billed against so
    // receiving documents roll forward (or back) too.
    for (const grnNumber of line.grnNumbers ?? []) {
      const grn = vendor.receivingDocuments.find((g) => g.grnNumber === grnNumber);
      if (!grn) continue;
      const grnItem = grn.items.find((it) => it.sku === line.sku);
      if (grnItem) {
        grnItem.invoicedQty = clamp(grnItem.invoicedQty, sign * line.invoiceQty, grnItem.quantity);
      }
      touchedGRNs.add(grnNumber);
    }
  }

  // Re-derive PO rollups + status from the item facts.
  touchedPOs.forEach((poNumber) => {
    const po = vendor.purchaseOrders.find((p) => p.poNumber === poNumber);
    if (!po) return;
    po.invoicedAmount = Math.round(po.items.reduce((s, it) => s + (it.invoicedQty || 0) * it.unitPrice, 0) * 100) / 100;
    if (po.status === 'Closed' || po.status === 'Cancelled') return;
    const fullyInvoiced = po.items.every((it) => (it.invoicedQty || 0) >= it.quantity);
    const anyInvoiced = po.items.some((it) => (it.invoicedQty || 0) > 0);
    if (fullyInvoiced) po.status = 'Fully Invoiced';
    else if (anyInvoiced) po.status = 'Partially Invoiced';
    // Releasing the last billed quantity returns the PO to its open,
    // invoiceable state so it reappears in the picker (VI-02).
    else po.status = 'Confirmed';
  });

  // GRN statuses follow their items (no status invented when fully
  // released — the receiving record simply reads no longer invoiced).
  touchedGRNs.forEach((grnNumber) => {
    const grn = vendor.receivingDocuments.find((g) => g.grnNumber === grnNumber);
    if (!grn) return;
    const fullyInvoiced = grn.items.every((it) => (it.invoicedQty || 0) >= it.quantity);
    const anyInvoiced = grn.items.some((it) => (it.invoicedQty || 0) > 0);
    if (fullyInvoiced) grn.status = 'Fully Invoiced';
    else if (anyInvoiced) grn.status = 'Partially Invoiced';
  });
}

export function applyInvoiceToVendorDocs(vendorName: string, lines: InvoicedLineRef[]): void {
  adjustVendorDocs(vendorName, lines, 1);
}

/** Give billed quantities back to the PO/GRNs (cancel, or the first half
 *  of an edit's replace). Mirror of applyInvoiceToVendorDocs. */
export function releaseInvoiceFromVendorDocs(vendorName: string, lines: InvoicedLineRef[]): void {
  adjustVendorDocs(vendorName, lines, -1);
}

/** Map a stored invoice's saved line items to the billed-line refs the
 *  vendor-docs functions consume (VI-01/VI-02): the invoiced quantity
 *  lives on `quantity`. Pre-invoice lines never touched the PO, so a
 *  Pre-Invoice record yields nothing to release/re-apply. */
export function billedLineRefsFromSaved(invoice: {
  type?: string;
  savedLineItems?: Array<{ sku: string; quantity: number; poNumber?: string; grnNumbers?: string[] }>;
}): InvoicedLineRef[] {
  if (invoice.type === 'Pre-Invoice' || !invoice.savedLineItems) return [];
  return invoice.savedLineItems
    .filter((l) => l.poNumber && l.quantity > 0)
    .map((l) => ({ poNumber: l.poNumber as string, sku: l.sku, invoiceQty: l.quantity, grnNumbers: l.grnNumbers }));
}

/** Partner-module deep link for a vendor (9/22/26 review response, GPT
 *  LINK-01): each vendor opens ITS OWN partner page, derived from its
 *  position in the shared vendor master — never a hardcoded v-001 that
 *  sent every invoice's Beta Corp link to Toyota International. */
export function partnerVendorUrl(vendorName: string): string {
  const idx = mockVendors.findIndex((v) => v.vendorName === vendorName);
  // Known vendors resolve to their master position; unknown ones — seed
  // invoices whose vendor isn't in the shared master — derive a STABLE,
  // DISTINCT id from the name (VI-24) instead of every one collapsing to
  // v-001, which made two different vendors open the same partner page.
  let n: number;
  if (idx >= 0) {
    n = idx + 1;
  } else {
    let h = 0;
    for (let i = 0; i < vendorName.length; i++) h = (vendorName.charCodeAt(i) + ((h << 5) - h)) | 0;
    n = (Math.abs(h) % 200) + 1;
  }
  return `https://partner-management-module.lovable.app/vendors/v-${String(n).padStart(3, '0')}`;
}
